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
//
// ULTIMATE DEBUG VERSION — remove verbose logging after confirming flow works.

router.post('/:token', async (req: Request, res: Response) => {
  const { token } = req.params;

  // ── FULL REQUEST DUMP ──
  console.log('╔══════════════════════════════════════════╗');
  console.log('║       --- PHISHING ATTEMPT ---           ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`[Phishing] Token: ${token}`);
  console.log(`[Phishing] Method: ${req.method}`);
  console.log(`[Phishing] URL: ${req.originalUrl}`);
  console.log(`[Phishing] Content-Type: ${req.get('Content-Type')}`);
  console.log(`[Phishing] Origin: ${req.get('Origin')}`);
  console.log(`[Phishing] Referer: ${req.get('Referer')}`);
  console.log('[Phishing] Headers:', JSON.stringify(req.headers, null, 2));
  console.log('[Phishing] Raw Body:', req.body);
  console.log(`[Phishing] Body type: ${typeof req.body}`);
  console.log(`[Phishing] Body is null: ${req.body === null}`);
  console.log(`[Phishing] Body is undefined: ${req.body === undefined}`);

  try {
    // ── DB INTEGRITY CHECK ──
    console.log(`[Phishing] Looking up token in DB: "${token}"`);
    const recipient = await getRecipientByToken(token);

    if (!recipient) {
      console.log(`[Phishing] ERROR: Token not found in database! token="${token}"`);
      // Force success response so we can at least confirm the browser reached the server
      res.status(200).json({ status: 'ok', debug: 'token_not_found_but_request_received' });
      return;
    }

    console.log(`[Phishing] Recipient found: id=${recipient.id}, campaignId=${recipient.campaignId}, status=${recipient.status}`);

    // ── INSERT EVENT ──
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');

    console.log(`[Phishing] Inserting 'submitted' event: campaign=${recipient.campaignId}, token=${token}`);
    await insertEvent('submitted', recipient.campaignId, token, ipAddress, userAgent);
    console.log(`[Phishing] Event inserted successfully`);

    // ── UPDATE STATUS ──
    if (recipient.status === 'sent' || recipient.status === 'clicked') {
      console.log(`[Phishing] Updating status from "${recipient.status}" to "submitted"`);
      await updateRecipientStatus(token, 'submitted');
      console.log(`[Phishing] Status updated successfully`);
    } else {
      console.log(`[Phishing] Status already "${recipient.status}", not updating`);
    }

    const body = req.body || {};
    const fields = Object.keys(body).join(',') || '(empty)';
    console.log(`[Phishing] CAPTURED: token=${token}, fields=${fields}, data=${JSON.stringify(body)}`);
    console.log('───────────────────────────────────────────');

    // ── FORCE SUCCESS ──
    res.status(200).json({ status: 'ok', success: true, message: 'Phishing simulation — data captured' });
  } catch (error) {
    console.error('[Phishing] EXCEPTION during submission:', error);
    // Force success response even on DB error — confirms browser reached server
    res.status(200).json({ status: 'ok', debug: 'exception_but_request_received', error: String(error) });
  }
});

export default router;
