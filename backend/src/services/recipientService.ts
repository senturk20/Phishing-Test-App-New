import { config } from '../config.js';
import { getPool, memoryStore, generateId, generateToken } from '../db/index.js';
import type { Recipient, RecipientStatus } from '../types/index.js';

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
    console.log(`Recipient created: ${recipient.email}`);
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
  console.log(`Recipient created: ${row.email}`);

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
    console.log(`${recipients.length} recipients created for campaign ${campaignId}`);
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
    console.log(`${recipients.length} recipients created for campaign ${campaignId}`);
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
