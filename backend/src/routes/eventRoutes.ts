import { Router, Request, Response, NextFunction } from 'express';
import {
  insertEvent,
  getRecipientByToken,
  updateRecipientStatus,
} from '../services/index.js';

const router = Router();

// ============================================
// VALIDATION
// ============================================

const validEventTypes = ['clicked', 'submitted', 'file_downloaded'] as const;
type EventType = typeof validEventTypes[number];

interface EventBody {
  type: EventType;
  campaignId: string;
  recipientToken: string;
}

function isValidEventBody(body: unknown): body is EventBody {
  if (typeof body !== 'object' || body === null) return false;
  const obj = body as Record<string, unknown>;
  return (
    typeof obj.type === 'string' &&
    validEventTypes.includes(obj.type as EventType) &&
    typeof obj.campaignId === 'string' &&
    obj.campaignId.length > 0 &&
    obj.campaignId.length <= 255 &&
    typeof obj.recipientToken === 'string' &&
    obj.recipientToken.length > 0 &&
    obj.recipientToken.length <= 255
  );
}

// ============================================
// ROUTES
// ============================================

// Track event — PUBLIC endpoint (no JWT required)
// Called by LandingPage.tsx when phishing targets interact with the page.
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log(`[Events] POST /events — type=${req.body?.type}, token=${req.body?.recipientToken}`);

    if (!isValidEventBody(req.body)) {
      console.log('[Events] Invalid body:', req.body);
      res.status(400).json({ error: 'Invalid request body' });
      return;
    }

    const { type, campaignId, recipientToken } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');

    // 1. Insert the event row
    await insertEvent(type, campaignId, recipientToken, ipAddress, userAgent);
    console.log(`[Events] Event inserted: type=${type}, campaign=${campaignId}, token=${recipientToken}`);

    // 2. Update recipient status based on event type
    const recipient = await getRecipientByToken(recipientToken);
    if (recipient) {
      if (type === 'clicked' && recipient.status === 'sent') {
        await updateRecipientStatus(recipientToken, 'clicked');
        console.log(`[Events] Recipient status updated: ${recipientToken} → clicked`);
      } else if (type === 'submitted' && (recipient.status === 'sent' || recipient.status === 'clicked')) {
        await updateRecipientStatus(recipientToken, 'submitted');
        console.log(`[Events] Recipient status updated: ${recipientToken} → submitted`);
      } else if (type === 'file_downloaded' && (recipient.status === 'sent' || recipient.status === 'clicked')) {
        await updateRecipientStatus(recipientToken, 'clicked');
        console.log(`[Events] Recipient status updated: ${recipientToken} → clicked (file_downloaded)`);
      }
    } else {
      console.log(`[Events] WARNING: Recipient not found for token="${recipientToken}"`);
    }

    res.status(201).json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
