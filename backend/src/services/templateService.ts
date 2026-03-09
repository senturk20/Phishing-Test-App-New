import { config } from '../config.js';
import { getPool, memoryStore, generateId } from '../db/index.js';
import type { EmailTemplate } from '../types/index.js';

// ============================================
// GET EMAIL TEMPLATES
// ============================================

export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  if (config.useMemoryDb) {
    return [...memoryStore.emailTemplates].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  const p = await getPool();
  if (!p) return [];

  const result = await p.query(
    `SELECT id, name, subject, body, category, is_default, created_at, updated_at
     FROM email_templates ORDER BY created_at DESC`
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    subject: row.subject,
    body: row.body,
    category: row.category || 'general',
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

// ============================================
// GET EMAIL TEMPLATE
// ============================================

export async function getEmailTemplate(id: string): Promise<EmailTemplate | null> {
  if (config.useMemoryDb) {
    return memoryStore.emailTemplates.find((t) => t.id === id) || null;
  }

  const p = await getPool();
  if (!p) return null;

  const result = await p.query(
    `SELECT id, name, subject, body, category, is_default, created_at, updated_at
     FROM email_templates WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    body: row.body,
    category: row.category || 'general',
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================
// CREATE EMAIL TEMPLATE
// ============================================

export async function createEmailTemplate(data: {
  name: string;
  subject: string;
  body: string;
  category?: string;
  isDefault?: boolean;
}): Promise<EmailTemplate> {
  const now = new Date();

  if (config.useMemoryDb) {
    if (data.isDefault) {
      memoryStore.emailTemplates.forEach((t) => (t.isDefault = false));
    }

    const template: EmailTemplate = {
      id: generateId(),
      name: data.name,
      subject: data.subject,
      body: data.body,
      category: data.category || 'general',
      isDefault: data.isDefault || false,
      createdAt: now,
      updatedAt: now,
    };
    memoryStore.emailTemplates.push(template);
    console.log(`Email template created: ${template.name}`);
    return template;
  }

  const p = await getPool();
  if (!p) throw new Error('Database not available');

  if (data.isDefault) {
    await p.query('UPDATE email_templates SET is_default = false');
  }

  const result = await p.query(
    `INSERT INTO email_templates (name, subject, body, category, is_default)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, subject, body, category, is_default, created_at, updated_at`,
    [data.name, data.subject, data.body, data.category || 'general', data.isDefault || false]
  );

  const row = result.rows[0];
  console.log(`Email template created: ${row.name}`);

  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    body: row.body,
    category: row.category || 'general',
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================
// UPDATE EMAIL TEMPLATE
// ============================================

export async function updateEmailTemplate(
  id: string,
  data: { name?: string; subject?: string; body?: string; category?: string; isDefault?: boolean }
): Promise<EmailTemplate | null> {
  if (config.useMemoryDb) {
    const template = memoryStore.emailTemplates.find((t) => t.id === id);
    if (!template) return null;

    if (data.isDefault) {
      memoryStore.emailTemplates.forEach((t) => (t.isDefault = false));
    }

    if (data.name !== undefined) template.name = data.name;
    if (data.subject !== undefined) template.subject = data.subject;
    if (data.body !== undefined) template.body = data.body;
    if (data.category !== undefined) template.category = data.category;
    if (data.isDefault !== undefined) template.isDefault = data.isDefault;
    template.updatedAt = new Date();
    return template;
  }

  const p = await getPool();
  if (!p) return null;

  if (data.isDefault) {
    await p.query('UPDATE email_templates SET is_default = false');
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  if (data.subject !== undefined) {
    updates.push(`subject = $${paramIndex++}`);
    values.push(data.subject);
  }
  if (data.body !== undefined) {
    updates.push(`body = $${paramIndex++}`);
    values.push(data.body);
  }
  if (data.category !== undefined) {
    updates.push(`category = $${paramIndex++}`);
    values.push(data.category);
  }
  if (data.isDefault !== undefined) {
    updates.push(`is_default = $${paramIndex++}`);
    values.push(data.isDefault);
  }

  if (updates.length === 0) return getEmailTemplate(id);

  updates.push(`updated_at = NOW()`);
  values.push(id);

  const result = await p.query(
    `UPDATE email_templates SET ${updates.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING id, name, subject, body, category, is_default, created_at, updated_at`,
    values
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    body: row.body,
    category: row.category || 'general',
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================
// DELETE EMAIL TEMPLATE
// ============================================

export async function deleteEmailTemplate(id: string): Promise<boolean> {
  if (config.useMemoryDb) {
    const index = memoryStore.emailTemplates.findIndex((t) => t.id === id);
    if (index === -1) return false;
    memoryStore.emailTemplates.splice(index, 1);
    return true;
  }

  const p = await getPool();
  if (!p) return false;

  const result = await p.query('DELETE FROM email_templates WHERE id = $1 RETURNING id', [id]);
  return result.rows.length > 0;
}
