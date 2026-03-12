import { Router, Request, Response } from 'express';
import {
  getRecipientByToken,
  updateRecipientStatus,
  insertEvent,
} from '../services/index.js';
import { config } from '../config.js';

const router = Router();

// ============================================
// POST /p/:token  — Phishing form submission capture
// ============================================
// The cloned landing page's <form> posts here.
// We log the "submitted" event and redirect to a real university page.

router.post('/:token', async (req: Request, res: Response) => {
  const { token } = req.params;

  console.log(`[Phishing] Form submission received for token: ${token}`);
  console.log(`[Phishing] Content-Type: ${req.get('Content-Type')}`);
  console.log(`[Phishing] Body keys: ${Object.keys(req.body || {}).join(', ') || '(empty)'}`);

  try {
    const recipient = await getRecipientByToken(token);

    if (!recipient) {
      console.log(`[Phishing] Token not found: "${token}" — redirecting anyway`);
      res.redirect(config.finalRedirectUrl);
      return;
    }

    console.log(`[Phishing] Recipient: id=${recipient.id}, campaign=${recipient.campaignId}, status=${recipient.status}`);

    // Insert submitted event
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');
    await insertEvent('submitted', recipient.campaignId, token, ipAddress, userAgent);

    // Update recipient status
    if (recipient.status === 'sent' || recipient.status === 'clicked') {
      await updateRecipientStatus(token, 'submitted');
    }

    const body = req.body || {};
    const fields = Object.keys(body).join(', ') || '(empty)';
    console.log(`[Phishing] CAPTURED: token=${token}, fields=${fields}`);

    // Redirect to real university page to maintain illusion
    res.redirect(config.finalRedirectUrl);
  } catch (error) {
    console.error('[Phishing] Exception during submission:', error);
    // Still redirect on error — don't expose internal state to the target
    res.redirect(config.finalRedirectUrl);
  }
});

export default router;
