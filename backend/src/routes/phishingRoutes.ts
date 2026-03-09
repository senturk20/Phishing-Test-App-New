import { Router, Request, Response } from 'express';
import {
  getRecipientByToken,
  updateRecipientStatus,
  insertEvent,
} from '../services/index.js';

const router = Router();

// ============================================
// POST /p/:token  — Phishing form submission capture
// ============================================
// The cloned landing page's <form> posts here.
// We log the "submitted" event and return education overlay data.

router.post('/:token', async (req: Request, res: Response) => {
  const { token } = req.params;

  try {
    const recipient = await getRecipientByToken(token);
    if (!recipient) {
      res.status(404).json({ error: 'Invalid token' });
      return;
    }

    // Log "submitted" event
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');
    await insertEvent('submitted', recipient.campaignId, token, ipAddress, userAgent);

    // Update recipient status to "submitted"
    if (recipient.status === 'sent' || recipient.status === 'clicked') {
      await updateRecipientStatus(token, 'submitted');
    }

    console.log(`[Phishing] Form submission captured: token=${token}, fields=${Object.keys(req.body).join(',')}`);

    // Return JSON — the injected hook script handles the response
    res.json({ success: true, message: 'Phishing simulation — data captured' });
  } catch (error) {
    console.error('[Phishing] Submission error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
