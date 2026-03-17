import { config } from '../config.js';
import { getPool, memoryStore, generateId } from '../db/index.js';

export interface Attachment {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  createdAt: Date;
}

// ============================================
// GET ALL ATTACHMENTS
// ============================================

export async function getAttachments(): Promise<Attachment[]> {
  if (config.useMemoryDb) {
    return (memoryStore as any).attachments || [];
  }

  const p = await getPool();
  if (!p) return [];

  const result = await p.query(
    `SELECT id, original_name, stored_name, mime_type, size, created_at
     FROM attachments ORDER BY created_at DESC`
  );

  return result.rows.map((row: any) => ({
    id: row.id,
    originalName: row.original_name,
    storedName: row.stored_name,
    mimeType: row.mime_type,
    size: row.size,
    createdAt: row.created_at,
  }));
}

// ============================================
// GET ATTACHMENT BY ID
// ============================================

export async function getAttachment(id: string): Promise<Attachment | null> {
  if (config.useMemoryDb) {
    const attachments = (memoryStore as any).attachments || [];
    return attachments.find((a: Attachment) => a.id === id) || null;
  }

  const p = await getPool();
  if (!p) return null;

  const result = await p.query(
    `SELECT id, original_name, stored_name, mime_type, size, created_at
     FROM attachments WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    originalName: row.original_name,
    storedName: row.stored_name,
    mimeType: row.mime_type,
    size: row.size,
    createdAt: row.created_at,
  };
}

// ============================================
// CREATE ATTACHMENT
// ============================================

export async function createAttachment(data: {
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
}): Promise<Attachment> {
  if (config.useMemoryDb) {
    if (!(memoryStore as any).attachments) (memoryStore as any).attachments = [];
    const attachment: Attachment = {
      id: generateId(),
      originalName: data.originalName,
      storedName: data.storedName,
      mimeType: data.mimeType,
      size: data.size,
      createdAt: new Date(),
    };
    (memoryStore as any).attachments.push(attachment);
    return attachment;
  }

  const p = await getPool();
  if (!p) throw new Error('Database not available');

  const result = await p.query(
    `INSERT INTO attachments (original_name, stored_name, mime_type, size)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [data.originalName, data.storedName, data.mimeType, data.size]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    originalName: row.original_name,
    storedName: row.stored_name,
    mimeType: row.mime_type,
    size: row.size,
    createdAt: row.created_at,
  };
}

// ============================================
// DELETE ATTACHMENT
// ============================================

export async function deleteAttachment(id: string): Promise<boolean> {
  if (config.useMemoryDb) {
    const attachments = (memoryStore as any).attachments || [];
    const idx = attachments.findIndex((a: Attachment) => a.id === id);
    if (idx === -1) return false;
    attachments.splice(idx, 1);
    return true;
  }

  const p = await getPool();
  if (!p) return false;

  const result = await p.query(`DELETE FROM attachments WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}
