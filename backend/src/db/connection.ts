import { config } from '../config.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('Database');

let pool: import('pg').Pool | null = null;

export async function getPool() {
  if (!pool && !config.useMemoryDb) {
    const pg = await import('pg');
    pool = new pg.default.Pool({
      connectionString: config.databaseUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pool;
}

export async function testConnection(): Promise<boolean> {
  if (config.useMemoryDb) {
    log.info('Using in-memory database');
    return true;
  }

  try {
    const p = await getPool();
    if (!p) return false;
    const client = await p.connect();
    await client.query('SELECT 1');
    client.release();
    log.info('PostgreSQL connection successful');
    return true;
  } catch (error) {
    log.error('PostgreSQL connection failed', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    log.info('Database pool closed');
  }
}
