import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { createReadStream, appendFileSync, mkdirSync, existsSync } from 'fs';
import fs from 'fs/promises';
import { config } from './config.js';
import { testConnection, closePool, getPool } from './db/index.js';
import {
  campaignRoutes,
  recipientRoutes,
  templateRoutes,
  landingPageRoutes,
  eventRoutes,
  dashboardRoutes,
  ldapRoutes,
  trackingRoutes,
  queueRoutes,
  authRoutes,
  clonerRoutes,
  phishingRoutes,
} from './routes/index.js';
import {
  closeLdapConnection,
  ldapHealthCheck,
  isRedisAvailable,
  startMailWorker,
  stopMailWorker,
  closeQueue,
  seedDefaultAdminIfNeeded,
  getLandingPage,
} from './services/index.js';
import { verifyToken } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// CRASH HANDLERS — Zero-Silent-Crash Policy
// Write to both stderr AND a persistent file before dying.
// The /app/logs volume is mapped in docker-compose so crashes
// survive container restarts.
// ============================================

const LOG_DIR = path.join(__dirname, '../logs');
if (!existsSync(LOG_DIR)) { try { mkdirSync(LOG_DIR, { recursive: true }); } catch { /* ok */ } }
const CRASH_LOG = path.join(LOG_DIR, 'crash.log');

function logCrash(type: string, err: unknown) {
  const msg = `[${new Date().toISOString()}] ${type}: ${err instanceof Error ? err.stack || err.message : String(err)}\n`;
  console.error(msg);
  try { appendFileSync(CRASH_LOG, msg); } catch { /* ignore write errors */ }
}

process.on('uncaughtException', (err) => {
  logCrash('uncaughtException', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logCrash('unhandledRejection', reason);
});

// ============================================
// EXPRESS APP
// ============================================

const app = express();

// ============================================
// STATIC FILES (for landing page clone assets)
// ============================================
app.use('/static', express.static(path.join(__dirname, '../static'), {
  maxAge: '1h',
  immutable: false,
}));

// ============================================
// TRACKING ROUTE (before security middleware)
// Must be BEFORE helmet/CSP — tracking pages have inline scripts.
// ============================================
app.use('/t', trackingRoutes);

// ============================================
// LANDING PAGE PREVIEW (before security middleware)
// Serves cloned HTML inside an iframe.
// Before helmet (strict CSP) and before verifyToken (iframes can't
// send Authorization headers).
// Uses createReadStream for cloned pages to avoid loading 500KB+
// HTML strings into memory.
// ============================================
app.get('/landing-pages/preview/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = await getLandingPage(req.params.id);
    if (!page) { res.status(404).send('Landing page not found'); return; }

    const permissiveCsp = "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; img-src * data: blob:; style-src * 'unsafe-inline'; font-src * data:; frame-src *; connect-src *;";
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', permissiveCsp);
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.removeHeader('X-Content-Type-Options');

    // For cloned pages — stream from disk instead of loading into memory
    if (page.isCloned) {
      const clonePath = path.join(__dirname, '../static/clones', req.params.id, 'index.html');
      try {
        await fs.access(clonePath);
        const stream = createReadStream(clonePath, 'utf-8');
        stream.on('error', () => {
          if (!res.headersSent) res.status(500).send('Error reading page');
        });
        stream.pipe(res);
        return;
      } catch {
        // File not found — fall through to DB HTML
      }
    }

    res.send(page.html);
  } catch (err) { next(err); }
});

// ============================================
// PHANTOM ASSET TRAP
// ============================================
// Cloned pages (AngularJS, React, etc.) request assets like
// /partials/*, /templates/*, /views/*, /assets/*, /bower_components/*
// These are ghost routes — the assets don't exist on our server.
// Without this trap they fall through to the rate limiter + verifyToken
// catch-all, generating a flood of 401s that kills the auth session.
// Must be BEFORE helmet, rate-limiter, and auth.
const PHANTOM_ASSET_PATTERN = /^\/(partials|templates|views|assets|bower_components|node_modules|vendor|dist|chunks|bundles)\//i;
const STATIC_ASSET_EXT = /\.(html|js|css|map|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|json)$/i;

app.use((req: Request, res: Response, next: NextFunction) => {
  // Catch phantom asset paths from cloned pages
  if (PHANTOM_ASSET_PATTERN.test(req.path)) {
    res.status(404).end();
    return;
  }
  // Catch any stray static-looking request that isn't under /static/
  // (e.g. /app/components/foo.html from an AngularJS router)
  if (STATIC_ASSET_EXT.test(req.path) && !req.path.startsWith('/static/') && !req.path.startsWith('/t/') && !req.path.startsWith('/auth') && !req.path.startsWith('/health')) {
    res.status(404).end();
    return;
  }
  next();
});

// ============================================
// MIDDLEWARE
// ============================================

app.use(helmet());
app.use(cors({
  origin: config.corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
  // Skip rate limiting for paths that must never be throttled
  skip: (req: Request) => {
    const p = req.path;
    return p === '/health'
      || p.startsWith('/auth')
      || p.startsWith('/static/')
      || p.startsWith('/t/')
      || p.startsWith('/p/')
      || p.startsWith('/events')
      || p.startsWith('/api/events');
  },
});
app.use(limiter);

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ============================================
// HEALTH CHECK (cached — never blocks during sends)
// ============================================

let healthCache: { ok: boolean; database: string; queue: string; ts: number } | null = null;
const HEALTH_CACHE_TTL = 10_000;

app.get('/health', async (_req: Request, res: Response) => {
  const now = Date.now();
  if (healthCache && now - healthCache.ts < HEALTH_CACHE_TTL) {
    res.status(healthCache.ok ? 200 : 503).json(healthCache);
    return;
  }

  try {
    await testConnection();
    const redisOk = await isRedisAvailable();
    healthCache = { ok: true, database: 'connected', queue: redisOk ? 'connected' : 'unavailable', ts: now };
    res.json(healthCache);
  } catch {
    healthCache = { ok: false, database: 'disconnected', queue: 'unknown', ts: now };
    res.status(503).json(healthCache);
  }
});

// ============================================
// PUBLIC ROUTES (no auth required)
// ============================================

app.use('/auth', authRoutes);
app.use('/p', phishingRoutes);
app.use('/events', eventRoutes);      // Direct calls (api.ts, LandingPage.tsx)
app.use('/api/events', eventRoutes);  // DB-seeded landing pages use /api/events (legacy nginx convention)

// ============================================
// PROTECTED ROUTES (JWT required)
// ============================================

app.use('/campaigns', verifyToken, campaignRoutes);
app.use('/', verifyToken, recipientRoutes);
app.use('/templates', verifyToken, templateRoutes);
app.use('/landing-pages', verifyToken, landingPageRoutes);
// /events is now public (mounted above) — no duplicate here
app.use('/dashboard', verifyToken, dashboardRoutes);
app.use('/ldap', verifyToken, ldapRoutes);
app.use('/queue', verifyToken, queueRoutes);
app.use('/clone', verifyToken, clonerRoutes);

// ============================================
// ERROR HANDLER
// ============================================

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Express Error]', err.stack || err.message);
  res.status(500).json({
    error: config.isProduction ? 'Internal server error' : err.message,
  });
});

// ============================================
// SERVER START
// ============================================

async function startServer() {
  console.log('[Boot] Starting server...');
  console.log(`[Boot] NODE_ENV=${process.env.NODE_ENV}, USE_MEMORY_DB=${config.useMemoryDb}`);
  console.log(`[Boot] Memory limit: ${process.env.NODE_OPTIONS || 'default'}`);

  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('[Boot] Failed to connect to database. Exiting...');
    process.exit(1);
  }

  // Run schema migrations
  if (!config.useMemoryDb) {
    try {
      const pool = await getPool();
      if (pool) {
        await pool.query(`ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'general';`);
        await pool.query(`
          CREATE TABLE IF NOT EXISTS admins (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            username VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(50) DEFAULT 'admin',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `);
        await pool.query(`ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS slug VARCHAR(255);`);
        await pool.query(`ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS original_url TEXT DEFAULT '';`);
        await pool.query(`ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS is_cloned BOOLEAN DEFAULT false;`);
        console.log('[Migration] Schema migrations applied successfully');
      }
    } catch (err) {
      console.error('[Migration] Failed to run migrations:', err);
    }
  }

  await seedDefaultAdminIfNeeded();

  // Non-blocking side tasks
  ldapHealthCheck().catch((err) => {
    console.error('[LDAP] Health check error:', err.message);
  });

  isRedisAvailable().then((available) => {
    if (available) {
      startMailWorker();
      console.log('[Queue] Mail worker started');
    } else {
      console.log('[Queue] Redis not available, using direct email sending');
    }
  }).catch((err) => {
    console.error('[Queue] Failed to check Redis:', err);
  });

  const server = app.listen(config.port, () => {
    console.log(`[Boot] Server running on port ${config.port}`);
  });

  server.on('error', (err) => {
    logCrash('server.error', err);
    process.exit(1);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[Shutdown] Shutting down gracefully...');
    server.close(async () => {
      try {
        await stopMailWorker();
        await closeQueue();
        closeLdapConnection();
        await closePool();
      } catch (err) {
        console.error('[Shutdown] Error during cleanup:', err);
      }
      process.exit(0);
    });
    // Force exit after 10s if graceful shutdown hangs
    setTimeout(() => { process.exit(1); }, 10000).unref();
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((err) => {
  logCrash('startServer', err);
  process.exit(1);
});
