import { config } from '../config.js';
import { getPool, memoryStore, generateId } from '../db/index.js';
import type { LandingPage } from '../types/index.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('LandingPageService');

// ============================================
// HELPERS
// ============================================

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100)
    || `page-${Date.now()}`;
}

// Columns for list views — NO html (can be 500KB+ per row, causes OOM)
const LIST_COLUMNS = 'id, name, slug, original_url, is_cloned, is_default, created_at, updated_at';

// Columns for single-page views — includes html for editing/preview
const FULL_COLUMNS = 'id, name, slug, html, original_url, is_cloned, is_default, created_at, updated_at';

function mapRow(row: Record<string, unknown>): LandingPage {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: (row.slug as string) || '',
    html: (row.html as string) || '',
    originalUrl: (row.original_url as string) || '',
    isCloned: (row.is_cloned as boolean) || false,
    isDefault: row.is_default as boolean,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

// ============================================
// GET LANDING PAGES (list — metadata only)
// ============================================

export async function getLandingPages(): Promise<LandingPage[]> {
  if (config.useMemoryDb) {
    return [...memoryStore.landingPages]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((p) => ({ ...p, html: '' }));
  }

  const p = await getPool();
  if (!p) return [];

  const result = await p.query(
    `SELECT ${LIST_COLUMNS} FROM landing_pages ORDER BY created_at DESC`
  );

  return result.rows.map(mapRow);
}

// ============================================
// GET LANDING PAGE (single — full HTML included)
// ============================================

export async function getLandingPage(id: string): Promise<LandingPage | null> {
  if (config.useMemoryDb) {
    return memoryStore.landingPages.find((p) => p.id === id) || null;
  }

  const pool = await getPool();
  if (!pool) return null;

  const result = await pool.query(
    `SELECT ${FULL_COLUMNS} FROM landing_pages WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) return null;
  return mapRow(result.rows[0]);
}

// ============================================
// CREATE LANDING PAGE
// ============================================

export async function createLandingPage(data: {
  name: string;
  html: string;
  slug?: string;
  originalUrl?: string;
  isCloned?: boolean;
  isDefault?: boolean;
}): Promise<LandingPage> {
  const now = new Date();
  const slug = data.slug || generateSlug(data.name);

  if (config.useMemoryDb) {
    if (data.isDefault) {
      memoryStore.landingPages.forEach((p) => (p.isDefault = false));
    }

    const page: LandingPage = {
      id: generateId(),
      name: data.name,
      slug,
      html: data.html,
      originalUrl: data.originalUrl || '',
      isCloned: data.isCloned || false,
      isDefault: data.isDefault || false,
      createdAt: now,
      updatedAt: now,
    };
    memoryStore.landingPages.push(page);
    log.info('Landing page created', { name: page.name });
    return page;
  }

  const p = await getPool();
  if (!p) throw new Error('Database not available');

  if (data.isDefault) {
    await p.query('UPDATE landing_pages SET is_default = false');
  }

  const result = await p.query(
    `INSERT INTO landing_pages (name, slug, html, original_url, is_cloned, is_default)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${FULL_COLUMNS}`,
    [data.name, slug, data.html, data.originalUrl || '', data.isCloned || false, data.isDefault || false]
  );

  log.info('Landing page created', { name: result.rows[0].name });
  return mapRow(result.rows[0]);
}

// ============================================
// UPDATE LANDING PAGE
// ============================================

export async function updateLandingPage(
  id: string,
  data: { name?: string; html?: string; slug?: string; originalUrl?: string; isCloned?: boolean; isDefault?: boolean }
): Promise<LandingPage | null> {
  if (config.useMemoryDb) {
    const page = memoryStore.landingPages.find((p) => p.id === id);
    if (!page) return null;

    if (data.isDefault) {
      memoryStore.landingPages.forEach((p) => (p.isDefault = false));
    }

    if (data.name !== undefined) page.name = data.name;
    if (data.html !== undefined) page.html = data.html;
    if (data.slug !== undefined) page.slug = data.slug;
    if (data.originalUrl !== undefined) page.originalUrl = data.originalUrl;
    if (data.isCloned !== undefined) page.isCloned = data.isCloned;
    if (data.isDefault !== undefined) page.isDefault = data.isDefault;
    page.updatedAt = new Date();
    return page;
  }

  const p = await getPool();
  if (!p) return null;

  if (data.isDefault) {
    await p.query('UPDATE landing_pages SET is_default = false');
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  if (data.html !== undefined) {
    updates.push(`html = $${paramIndex++}`);
    values.push(data.html);
  }
  if (data.slug !== undefined) {
    updates.push(`slug = $${paramIndex++}`);
    values.push(data.slug);
  }
  if (data.originalUrl !== undefined) {
    updates.push(`original_url = $${paramIndex++}`);
    values.push(data.originalUrl);
  }
  if (data.isCloned !== undefined) {
    updates.push(`is_cloned = $${paramIndex++}`);
    values.push(data.isCloned);
  }
  if (data.isDefault !== undefined) {
    updates.push(`is_default = $${paramIndex++}`);
    values.push(data.isDefault);
  }

  if (updates.length === 0) return getLandingPage(id);

  updates.push(`updated_at = NOW()`);
  values.push(id);

  const result = await p.query(
    `UPDATE landing_pages SET ${updates.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING ${FULL_COLUMNS}`,
    values
  );

  if (result.rows.length === 0) return null;
  return mapRow(result.rows[0]);
}

// ============================================
// DELETE LANDING PAGE
// ============================================

export async function deleteLandingPage(id: string): Promise<boolean> {
  if (config.useMemoryDb) {
    const index = memoryStore.landingPages.findIndex((p) => p.id === id);
    if (index === -1) return false;
    memoryStore.landingPages.splice(index, 1);
    return true;
  }

  const p = await getPool();
  if (!p) return false;

  const result = await p.query('DELETE FROM landing_pages WHERE id = $1 RETURNING id', [id]);
  return result.rows.length > 0;
}
