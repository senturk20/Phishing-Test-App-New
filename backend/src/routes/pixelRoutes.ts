import { Router, Request, Response } from 'express';
import { getRecipientByToken, insertEvent } from '../services/index.js';
import { config } from '../config.js';
import { getPool, memoryStore } from '../db/index.js';
import { extractClientInfo } from '../utils/eventLogger.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('Pixel');
const router = Router();

// 1x1 transparent GIF (43 bytes)
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

// ============================================
// GET /static/images/footer-header.png?t=TOKEN
// ============================================

router.get('/footer-header.png', async (req: Request, res: Response) => {
  // Always return the image — even if token is invalid
  res.set({
    'Content-Type': 'image/gif',
    'Content-Length': String(TRANSPARENT_GIF.length),
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  });

  const token = req.query.t as string | undefined;
  if (!token) {
    res.end(TRANSPARENT_GIF);
    return;
  }

  try {
    const recipient = await getRecipientByToken(token);
    if (!recipient) {
      res.end(TRANSPARENT_GIF);
      return;
    }

    // Deduplicate: check if 'opened' event already exists for this token
    let alreadyOpened = false;

    if (config.useMemoryDb) {
      alreadyOpened = memoryStore.events.some(
        e => e.type === 'opened' && e.recipientToken === token
      );
    } else {
      const p = await getPool();
      if (p) {
        const result = await p.query(
          `SELECT 1 FROM events WHERE type = 'opened' AND recipient_token = $1 LIMIT 1`,
          [token]
        );
        alreadyOpened = result.rows.length > 0;
      }
    }

    if (!alreadyOpened) {
      const { ipAddress, userAgent } = extractClientInfo(req);
      await insertEvent('opened', recipient.campaignId, token, ipAddress, userAgent);
      log.info('Email opened', { token, campaignId: recipient.campaignId });
    }
  } catch (err) {
    log.error('Error tracking open', { error: err instanceof Error ? err.message : String(err) });
  }

  res.end(TRANSPARENT_GIF);
});

export default router;
