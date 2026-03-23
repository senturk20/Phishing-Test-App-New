import { config } from '../config.js';
import { getPool, memoryStore, generateId } from '../db/index.js';
import type { CampaignEvent } from '../types/index.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('EventService');

// ============================================
// GET EVENTS BY CAMPAIGN
// ============================================

export async function getEventsByCampaign(campaignId: string): Promise<CampaignEvent[]> {
  if (config.useMemoryDb) {
    return memoryStore.events
      .filter((e) => e.campaignId === campaignId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  const p = await getPool();
  if (!p) return [];

  const result = await p.query(
    `SELECT id, campaign_id, type, recipient_token, ip_address, user_agent, created_at
     FROM events WHERE campaign_id = $1 ORDER BY created_at DESC`,
    [campaignId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    campaignId: row.campaign_id,
    type: row.type,
    recipientToken: row.recipient_token,
    ipAddress: row.ip_address ?? undefined,
    userAgent: row.user_agent ?? undefined,
    createdAt: row.created_at,
  }));
}

// ============================================
// INSERT EVENT
// ============================================

export async function insertEvent(
  type: string,
  campaignId: string,
  recipientToken: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  if (config.useMemoryDb) {
    memoryStore.events.push({
      id: generateId(),
      type,
      campaignId,
      recipientToken,
      ipAddress,
      userAgent,
      createdAt: new Date(),
    });
    log.debug('Event recorded', { type, campaignId });
    return;
  }

  const p = await getPool();
  if (!p) throw new Error('Database not available');

  await p.query(
    `INSERT INTO events (campaign_id, type, recipient_token, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [campaignId, type, recipientToken, ipAddress || null, userAgent || null]
  );
  log.debug('Event recorded', { type, campaignId });
}
