import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
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
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ============================================
// STATIC FILES (for landing page assets)
// ============================================
app.use('/static', express.static(path.join(__dirname, '../static')));

// ============================================
// TRACKING ROUTE (before security middleware)
// ============================================
// The /t/:token endpoint serves landing page HTML from the DB which
// contains inline scripts and styles. It must be registered BEFORE
// helmet/CSP so those inline resources are not blocked.
app.use('/t', trackingRoutes);

// ============================================
// LANDING PAGE PREVIEW (before security middleware)
// ============================================
// The preview endpoint serves cloned HTML inside an iframe.
// It must be BEFORE helmet (which injects strict CSP / X-Frame-Options)
// and BEFORE verifyToken (iframes can't send Authorization headers).
app.get('/landing-pages/preview/:id', async (req, res, next) => {
  try {
    const page = await getLandingPage(req.params.id);
    if (!page) { res.status(404).send('Landing page not found'); return; }

    // Permissive headers — required for iframe embedding and loading sub-assets
    const permissiveCsp = "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; img-src * data: blob:; style-src * 'unsafe-inline'; font-src * data:; frame-src *; connect-src *;";
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', permissiveCsp);
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.removeHeader('X-Content-Type-Options');

    // For cloned pages, try to serve the static index.html from disk
    if (page.isCloned) {
      const clonePath = path.join(__dirname, '../static/clones', req.params.id, 'index.html');
      try {
        const html = await fs.readFile(clonePath, 'utf-8');
        res.send(html);
        return;
      } catch {
        // Static file not found — fall through to DB HTML
      }
    }

    res.send(page.html);
  } catch (err) { next(err); }
});


// ============================================
// MIDDLEWARE
// ============================================

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});
app.use(limiter);

// Body parser
app.use(express.json({ limit: '5mb' }));

// ============================================
// HEALTH CHECK (cached — never blocks during campaign sends)
// ============================================

let healthCache: { ok: boolean; database: string; queue: string; ts: number } | null = null;
const HEALTH_CACHE_TTL = 10_000; // 10 seconds

app.get('/health', async (_req: Request, res: Response) => {
  // Return cached result if fresh enough — prevents DB/Redis round-trips
  // from blocking when the event loop is busy sending emails.
  const now = Date.now();
  if (healthCache && now - healthCache.ts < HEALTH_CACHE_TTL) {
    const status = healthCache.ok ? 200 : 503;
    res.status(status).json(healthCache);
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

// Phishing form submission — public, no auth (forms post here from cloned pages)
app.use('/p', phishingRoutes);

// ============================================
// PROTECTED ROUTES (JWT required)
// ============================================

app.use('/campaigns', verifyToken, campaignRoutes);
app.use('/', recipientRoutes);
app.use('/templates', verifyToken, templateRoutes);
app.use('/landing-pages', verifyToken, landingPageRoutes);
app.use('/events', verifyToken, eventRoutes);
app.use('/dashboard', verifyToken, dashboardRoutes);
app.use('/ldap', verifyToken, ldapRoutes);
app.use('/queue', verifyToken, queueRoutes);
app.use('/clone', verifyToken, clonerRoutes);

// ============================================
// ERROR HANDLER
// ============================================

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({
    error: config.isProduction ? 'Internal server error' : err.message,
  });
});

// ============================================
// SERVER START
// ============================================

async function startServer() {
  // Test database connection
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('Failed to connect to database. Exiting...');
    process.exit(1);
  }

  // Run schema migrations for existing databases
  if (!config.useMemoryDb) {
    try {
      const pool = await getPool();
      if (pool) {
        await pool.query(`
          ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'general';
        `);
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

  // Seed default admin (admin / admin123)
  await seedDefaultAdminIfNeeded();

  // LDAP health check (non-blocking — logs diagnostics but doesn't prevent startup)
  ldapHealthCheck().catch((err) => {
    console.error('[LDAP] Health check error:', err.message);
  });

  // Start mail worker if Redis is available (non-blocking)
  isRedisAvailable().then((available) => {
    if (available) {
      startMailWorker();
    } else {
      console.log('[Queue] Redis not available, using direct email sending');
    }
  }).catch((err) => {
    console.error('[Queue] Failed to check Redis:', err);
  });

  // Start server
  const server = app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down...');
    server.close(async () => {
      await stopMailWorker();
      await closeQueue();
      closeLdapConnection();
      await closePool();
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();
