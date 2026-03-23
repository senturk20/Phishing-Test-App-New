import { Router, Request, Response } from 'express';
import { getRecipientByToken } from '../services/index.js';
import { config } from '../config.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { trackEvent } from '../utils/eventLogger.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('Phishing');
const router = Router();

// ============================================
// POST /p/:token  — Phishing form submission capture
// ============================================

router.post('/:token', asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params;

  log.info('Form submission received', { token });

  try {
    const recipient = await getRecipientByToken(token);

    if (!recipient) {
      log.warn('Token not found, redirecting anyway', { token });
      res.redirect(config.finalRedirectUrl);
      return;
    }

    await trackEvent({
      type: 'submitted',
      campaignId: recipient.campaignId,
      token,
      req,
      updateStatus: true,
    });

    const fields = Object.keys(req.body || {}).join(', ') || '(empty)';
    log.info('Credentials captured', { token, fields });

    res.redirect(config.finalRedirectUrl);
  } catch (error) {
    log.error('Exception during submission', { error: error instanceof Error ? error.message : String(error) });
    res.redirect(config.finalRedirectUrl);
  }
}));

export default router;
