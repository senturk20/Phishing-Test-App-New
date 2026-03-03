import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { testConnection, closePool } from './db/index.js';
import {
  campaignRoutes,
  recipientRoutes,
  templateRoutes,
  landingPageRoutes,
  eventRoutes,
  dashboardRoutes,
  ldapRoutes,
  trackingRoutes,
} from './routes/index.js';
import { closeLdapConnection } from './services/index.js';

const app = express();

// ============================================
// TRACKING ROUTE (before security middleware)
// ============================================
// The /t/:token endpoint serves landing page HTML from the DB which
// contains inline scripts and styles. It must be registered BEFORE
// helmet/CSP so those inline resources are not blocked.
app.use('/t', trackingRoutes);

// ============================================
// MIDDLEWARE
// ============================================

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type'],
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
app.use(express.json({ limit: '10kb' }));

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', async (_req: Request, res: Response) => {
  try {
    await testConnection();
    res.json({ ok: true, database: 'connected' });
  } catch {
    res.status(503).json({ ok: false, database: 'disconnected' });
  }
});

// ============================================
// ROUTES
// ============================================

app.use('/campaigns', campaignRoutes);
app.use('/', recipientRoutes);
app.use('/templates', templateRoutes);
app.use('/landing-pages', landingPageRoutes);
app.use('/events', eventRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/ldap', ldapRoutes);

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

  // Start server
  const server = app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down...');
    server.close(async () => {
      closeLdapConnection();
      await closePool();
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();
