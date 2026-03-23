import { Request } from 'express';
import { insertEvent } from '../services/eventService.js';
import { getRecipientByToken, updateRecipientStatus } from '../services/recipientService.js';
import { createLogger } from './logger.js';
import type { RecipientStatus } from '../types/index.js';

const log = createLogger('EventLogger');

// ============================================
// EXTRACT CLIENT INFO FROM REQUEST
// ============================================

export function extractClientInfo(req: Request): { ipAddress: string | undefined; userAgent: string | undefined } {
  return {
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.get('User-Agent'),
  };
}

// ============================================
// LOG AND TRACK EVENT (consolidated logic)
// ============================================
// Used by: phishingRoutes, trackingRoutes, eventRoutes, pixelRoutes
// Handles: insert event → update recipient status → log

interface TrackEventOptions {
  type: string;
  campaignId: string;
  token: string;
  req: Request;
  /** If true, update recipient status based on event type */
  updateStatus?: boolean;
}

/**
 * Consolidated event tracking:
 * 1. Insert event record
 * 2. Optionally update recipient status based on event type
 * 3. Log the event
 */
export async function trackEvent(opts: TrackEventOptions): Promise<void> {
  const { type, campaignId, token, req, updateStatus = true } = opts;
  const { ipAddress, userAgent } = extractClientInfo(req);

  await insertEvent(type, campaignId, token, ipAddress, userAgent);
  log.info(`Event recorded: ${type}`, { campaignId, token });

  if (!updateStatus) return;

  const recipient = await getRecipientByToken(token);
  if (!recipient) {
    log.warn('Recipient not found for status update', { token });
    return;
  }

  const statusTransitions: Record<string, { from: RecipientStatus[]; to: RecipientStatus }> = {
    clicked: { from: ['sent'], to: 'clicked' },
    submitted: { from: ['sent', 'clicked'], to: 'submitted' },
    file_downloaded: { from: ['sent', 'clicked'], to: 'clicked' },
  };

  const transition = statusTransitions[type];
  if (transition && transition.from.includes(recipient.status)) {
    await updateRecipientStatus(token, transition.to);
    log.info(`Recipient status updated: ${recipient.status} → ${transition.to}`, { token });
  }
}
