import bcrypt from 'bcrypt';
import { config } from '../config.js';
import { getPool, memoryStore, generateId } from '../db/index.js';
import type { Admin } from '../types/index.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('AdminService');

const SALT_ROUNDS = 10;

// ============================================
// MEMORY MODE HELPERS
// ============================================

let memorySeeded = false;

async function seedDefaultAdmin(): Promise<void> {
  if (memorySeeded) return;
  memorySeeded = true;

  const hash = await bcrypt.hash('admin123', SALT_ROUNDS);
  memoryStore.admins.push({
    id: generateId(),
    username: 'admin',
    passwordHash: hash,
    role: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

// ============================================
// PUBLIC API
// ============================================

export async function getAdminByUsername(username: string): Promise<Admin | null> {
  if (config.useMemoryDb) {
    await seedDefaultAdmin();
    return memoryStore.admins.find((a) => a.username === username) || null;
  }

  const pool = await getPool();
  if (!pool) return null;

  const result = await pool.query(
    'SELECT id, username, password_hash, role, created_at, updated_at FROM admins WHERE username = $1',
    [username]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAdminById(id: string): Promise<Admin | null> {
  if (config.useMemoryDb) {
    await seedDefaultAdmin();
    return memoryStore.admins.find((a) => a.id === id) || null;
  }

  const pool = await getPool();
  if (!pool) return null;

  const result = await pool.query(
    'SELECT id, username, password_hash, role, created_at, updated_at FROM admins WHERE id = $1',
    [id]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createAdmin(data: {
  username: string;
  password: string;
  role?: string;
}): Promise<Admin> {
  const hash = await bcrypt.hash(data.password, SALT_ROUNDS);

  if (config.useMemoryDb) {
    await seedDefaultAdmin();
    const admin: Admin = {
      id: generateId(),
      username: data.username,
      passwordHash: hash,
      role: data.role || 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryStore.admins.push(admin);
    return admin;
  }

  const pool = await getPool();
  if (!pool) throw new Error('Database not available');

  const result = await pool.query(
    `INSERT INTO admins (username, password_hash, role)
     VALUES ($1, $2, $3)
     RETURNING id, username, password_hash, role, created_at, updated_at`,
    [data.username, hash, data.role || 'admin']
  );

  const row = result.rows[0];
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function seedDefaultAdminIfNeeded(): Promise<void> {
  if (config.useMemoryDb) {
    await seedDefaultAdmin();
    return;
  }

  const pool = await getPool();
  if (!pool) return;

  const result = await pool.query('SELECT COUNT(*) as count FROM admins');
  const count = parseInt(result.rows[0].count, 10);

  if (count === 0) {
    const hash = await bcrypt.hash('admin123', SALT_ROUNDS);
    await pool.query(
      `INSERT INTO admins (username, password_hash, role) VALUES ($1, $2, $3)`,
      ['admin', hash, 'admin']
    );
    log.info('Default admin seeded (admin / admin123)');
  }
}
