import { config } from '../config.js';

// ============================================
// LOG LEVELS
// ============================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const minLevel: LogLevel = config.isProduction ? 'info' : 'debug';

// ============================================
// STRUCTURED LOGGER
// ============================================

function formatMessage(level: LogLevel, context: string, message: string, meta?: Record<string, unknown>): string {
  const ts = new Date().toISOString();
  const metaStr = meta ? ' ' + JSON.stringify(meta) : '';
  return `[${ts}] [${level.toUpperCase()}] [${context}] ${message}${metaStr}`;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel];
}

/**
 * Create a scoped logger for a specific module/context.
 *
 * Usage:
 *   const log = createLogger('LDAP');
 *   log.info('Connection successful');
 *   log.error('Bind failed', { dn: 'cn=admin' });
 */
export function createLogger(context: string) {
  return {
    debug(message: string, meta?: Record<string, unknown>) {
      if (shouldLog('debug')) console.debug(formatMessage('debug', context, message, meta));
    },
    info(message: string, meta?: Record<string, unknown>) {
      if (shouldLog('info')) console.log(formatMessage('info', context, message, meta));
    },
    warn(message: string, meta?: Record<string, unknown>) {
      if (shouldLog('warn')) console.warn(formatMessage('warn', context, message, meta));
    },
    error(message: string, meta?: Record<string, unknown>) {
      if (shouldLog('error')) console.error(formatMessage('error', context, message, meta));
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;
