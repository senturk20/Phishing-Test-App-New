import { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';
import { createLogger } from './logger.js';

const log = createLogger('HTTP');

// ============================================
// ASYNC HANDLER — wraps async route handlers
// ============================================
// Eliminates repetitive try/catch in every route.
// Errors are caught and forwarded to Express error middleware.

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export function asyncHandler(fn: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

// ============================================
// STANDARDIZED API RESPONSES
// ============================================

export function sendSuccess<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ success: true, data });
}

export function sendError(res: Response, status: number, message: string): void {
  res.status(status).json({ success: false, error: message });
}

// ============================================
// GLOBAL ERROR HANDLER MIDDLEWARE
// ============================================

export function globalErrorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  log.error(`${req.method} ${req.path}`, {
    message: err.message,
    ...(config.isProduction ? {} : { stack: err.stack }),
  });

  const status = (err as Error & { status?: number }).status || 500;
  const message = config.isProduction ? 'Internal server error' : err.message;

  res.status(status).json({ success: false, error: message });
}
