import { Router, Request, Response } from 'express';
import { asyncHandler, sendSuccess, sendError } from '../utils/asyncHandler.js';
import { trackEvent } from '../utils/eventLogger.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('Events');
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
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  log.debug('POST /events', { type: req.body?.type, token: req.body?.recipientToken });

  if (!isValidEventBody(req.body)) {
    sendError(res, 400, 'Invalid request body');
    return;
  }

  const { type, campaignId, recipientToken } = req.body;

  await trackEvent({
    type,
    campaignId,
    token: recipientToken,
    req,
    updateStatus: true,
  });

  sendSuccess(res, null, 201);
}));

export default router;
