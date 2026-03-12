import { Router, Request, Response } from 'express';
import { getRecipientByToken, insertEvent } from '../services/index.js';
import { config } from '../config.js';
import { getPool, memoryStore } from '../db/index.js';

const router = Router();

// 1x1 transparent GIF (43 bytes)
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

// ============================================
// GET /static/images/footer-header.png?t=TOKEN
// ============================================
// Stealth tracking pixel — injected into outbound emails.
// When the email client loads this image, we log an 'opened' event.
// Deduplication: only one 'opened' event per recipient.

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
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.get('User-Agent');
      await insertEvent('opened', recipient.campaignId, token, ipAddress, userAgent);
      console.log(`[Pixel] Email opened: token=${token}, campaign=${recipient.campaignId}`);
    }
  } catch (err) {
    // Never fail the image response — log and move on
    console.error('[Pixel] Error tracking open:', err);
  }

  res.end(TRANSPARENT_GIF);
});

export default router;
