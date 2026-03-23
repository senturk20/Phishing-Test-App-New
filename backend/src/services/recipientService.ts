import { config } from '../config.js';
import { getPool, memoryStore, generateId, generateToken } from '../db/index.js';
import type { Recipient, RecipientStatus } from '../types/index.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('RecipientService');

// ============================================
// GET RECIPIENTS BY CAMPAIGN
// ============================================

export async function getRecipientsByCampaign(campaignId: string): Promise<Recipient[]> {
  if (config.useMemoryDb) {
    return memoryStore.recipients
      .filter((r) => r.campaignId === campaignId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  const p = await getPool();
  if (!p) return [];

  const result = await p.query(
    `SELECT id, campaign_id, email, first_name, last_name, department, faculty, role, token, status,
            sent_at, clicked_at, submitted_at, created_at, updated_at
     FROM recipients WHERE campaign_id = $1 ORDER BY created_at ASC`,
    [campaignId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    campaignId: row.campaign_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    department: row.department || '',
    faculty: row.faculty || '',
    role: row.role || '',
    token: row.token,
    status: row.status,
    sentAt: row.sent_at ?? undefined,
    clickedAt: row.clicked_at ?? undefined,
    submittedAt: row.submitted_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

// ============================================
// CREATE RECIPIENT
// ============================================

export async function createRecipient(data: {
  campaignId: string;
  email: string;
  firstName: string;
  lastName: string;
}): Promise<Recipient> {
  const now = new Date();
  const token = generateToken();

  if (config.useMemoryDb) {
    const recipient: Recipient = {
      id: generateId(),
      campaignId: data.campaignId,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      department: '',
      faculty: '',
      role: '',
      token,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    memoryStore.recipients.push(recipient);
    log.info('Recipient created', { email: recipient.email });
    return recipient;
  }

  const p = await getPool();
  if (!p) throw new Error('Database not available');

  const result = await p.query(
    `INSERT INTO recipients (campaign_id, email, first_name, last_name, token)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, campaign_id, email, first_name, last_name, department, faculty, role, token, status,
               sent_at, clicked_at, submitted_at, created_at, updated_at`,
    [data.campaignId, data.email, data.firstName, data.lastName, token]
  );

  const row = result.rows[0];
  log.info('Recipient created', { email: row.email });

  return {
    id: row.id,
    campaignId: row.campaign_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    department: row.department || '',
    faculty: row.faculty || '',
    role: row.role || '',
    token: row.token,
    status: row.status,
    sentAt: row.sent_at ?? undefined,
    clickedAt: row.clicked_at ?? undefined,
    submittedAt: row.submitted_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================
// CREATE RECIPIENTS BULK
// ============================================

export async function createRecipientsBulk(
  campaignId: string,
  recipients: Array<{ email: string; firstName: string; lastName: string }>
): Promise<number> {
  if (config.useMemoryDb) {
    const now = new Date();
    for (const r of recipients) {
      memoryStore.recipients.push({
        id: generateId(),
        campaignId,
        email: r.email,
        firstName: r.firstName,
        lastName: r.lastName,
        department: '',
        faculty: '',
        role: '',
        token: generateToken(),
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      });
    }
    log.info('Recipients created in bulk', { count: recipients.length, campaignId });
    return recipients.length;
  }

  const p = await getPool();
  if (!p) throw new Error('Database not available');

  const client = await p.connect();
  try {
    await client.query('BEGIN');
    for (const r of recipients) {
      await client.query(
        `INSERT INTO recipients (campaign_id, email, first_name, last_name, token)
         VALUES ($1, $2, $3, $4, $5)`,
        [campaignId, r.email, r.firstName, r.lastName, generateToken()]
      );
    }
    await client.query('COMMIT');
    log.info('Recipients created in bulk', { count: recipients.length, campaignId });
    return recipients.length;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ============================================
// UPDATE RECIPIENT STATUS
// ============================================

export async function updateRecipientStatus(
  token: string,
  status: RecipientStatus
): Promise<Recipient | null> {
  const now = new Date();

  if (config.useMemoryDb) {
    const recipient = memoryStore.recipients.find((r) => r.token === token);
    if (!recipient) return null;

    recipient.status = status;
    recipient.updatedAt = now;
    if (status === 'sent') recipient.sentAt = now;
    if (status === 'clicked') recipient.clickedAt = now;
    if (status === 'submitted') recipient.submittedAt = now;

    return recipient;
  }

  const p = await getPool();
  if (!p) return null;

  let extraFields = '';
  if (status === 'sent') extraFields = ', sent_at = NOW()';
  if (status === 'clicked') extraFields = ', clicked_at = NOW()';
  if (status === 'submitted') extraFields = ', submitted_at = NOW()';

  const result = await p.query(
    `UPDATE recipients SET status = $1, updated_at = NOW() ${extraFields}
     WHERE token = $2
     RETURNING id, campaign_id, email, first_name, last_name, department, faculty, role, token, status,
               sent_at, clicked_at, submitted_at, created_at, updated_at`,
    [status, token]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    campaignId: row.campaign_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    department: row.department || '',
    faculty: row.faculty || '',
    role: row.role || '',
    token: row.token,
    status: row.status,
    sentAt: row.sent_at ?? undefined,
    clickedAt: row.clicked_at ?? undefined,
    submittedAt: row.submitted_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================
// DELETE RECIPIENT
// ============================================

export async function deleteRecipient(id: string): Promise<boolean> {
  if (config.useMemoryDb) {
    const index = memoryStore.recipients.findIndex((r) => r.id === id);
    if (index === -1) return false;
    memoryStore.recipients.splice(index, 1);
    return true;
  }

  const p = await getPool();
  if (!p) return false;

  const result = await p.query('DELETE FROM recipients WHERE id = $1 RETURNING id', [id]);
  return result.rows.length > 0;
}

// ============================================
// GET RECIPIENT BY TOKEN
// ============================================

export async function getRecipientByToken(token: string): Promise<Recipient | null> {
  if (config.useMemoryDb) {
    return memoryStore.recipients.find((r) => r.token === token) || null;
  }

  const p = await getPool();
  if (!p) return null;

  const result = await p.query(
    `SELECT id, campaign_id, email, first_name, last_name, department, faculty, role, token, status,
            sent_at, clicked_at, submitted_at, created_at, updated_at
     FROM recipients WHERE token = $1`,
    [token]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    campaignId: row.campaign_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    department: row.department || '',
    faculty: row.faculty || '',
    role: row.role || '',
    token: row.token,
    status: row.status,
    sentAt: row.sent_at ?? undefined,
    clickedAt: row.clicked_at ?? undefined,
    submittedAt: row.submitted_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================
// GET ALL RECIPIENTS (paginated, cross-campaign)
// ============================================

export interface AllRecipientsResult {
  users: Recipient[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getAllRecipients(opts: {
  page?: number;
  pageSize?: number;
  faculty?: string;
  search?: string;
  status?: string;
}): Promise<AllRecipientsResult> {
  const page = Math.max(1, opts.page || 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize || 25));
  const offset = (page - 1) * pageSize;

  if (config.useMemoryDb) {
    let list = [...memoryStore.recipients];

    // Deduplicate by email — keep the most recent entry per user
    const emailMap = new Map<string, typeof list[0]>();
    for (const r of list) {
      const existing = emailMap.get(r.email);
      if (!existing || r.createdAt.getTime() > existing.createdAt.getTime()) {
        emailMap.set(r.email, r);
      }
    }
    list = Array.from(emailMap.values());

    if (opts.faculty) list = list.filter(r => r.faculty === opts.faculty);
    if (opts.status) list = list.filter(r => r.status === opts.status);
    if (opts.search) {
      const q = opts.search.toLowerCase();
      list = list.filter(r =>
        r.email.toLowerCase().includes(q) ||
        r.firstName.toLowerCase().includes(q) ||
        r.lastName.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return { users: list.slice(offset, offset + pageSize), total: list.length, page, pageSize };
  }

  const p = await getPool();
  if (!p) return { users: [], total: 0, page, pageSize };

  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let paramIdx = 1;

  if (opts.faculty) {
    conditions.push(`r.faculty = $${paramIdx++}`);
    params.push(opts.faculty);
  }
  if (opts.status) {
    conditions.push(`r.status = $${paramIdx++}`);
    params.push(opts.status);
  }
  if (opts.search) {
    conditions.push(`(r.email ILIKE $${paramIdx} OR r.first_name ILIKE $${paramIdx} OR r.last_name ILIKE $${paramIdx})`);
    params.push(`%${opts.search}%`);
    paramIdx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Deduplicate by email, keep most recent per user
  const baseQuery = `
    FROM (
      SELECT DISTINCT ON (r.email)
        r.id, r.campaign_id, r.email, r.first_name, r.last_name,
        r.department, r.faculty, r.role, r.token, r.status,
        r.sent_at, r.clicked_at, r.submitted_at, r.created_at, r.updated_at
      FROM recipients r
      ${where}
      ORDER BY r.email, r.created_at DESC
    ) r
  `;

  const countResult = await p.query(`SELECT COUNT(*) as count ${baseQuery}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  const dataResult = await p.query(
    `SELECT * ${baseQuery} ORDER BY r.created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, pageSize, offset]
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const users: Recipient[] = dataResult.rows.map((row: any) => ({
    id: row.id,
    campaignId: row.campaign_id,
    email: row.email,
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    department: row.department || '',
    faculty: row.faculty || '',
    role: row.role || '',
    token: row.token,
    status: row.status,
    sentAt: row.sent_at ?? undefined,
    clickedAt: row.clicked_at ?? undefined,
    submittedAt: row.submitted_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return { users, total, page, pageSize };
}
