import { Router, Request, Response } from 'express';
import {
  getRecipientsByCampaign,
  createRecipient,
  createRecipientsBulk,
  updateRecipientStatus,
  deleteRecipient,
  getRecipientByToken,
} from '../services/index.js';
import type { RecipientStatus } from '../types/index.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/asyncHandler.js';

const router = Router();

// ============================================
// VALIDATION
// ============================================

interface CreateRecipientBody {
  email: string;
  firstName: string;
  lastName: string;
}

function isValidRecipientBody(body: unknown): body is CreateRecipientBody {
  if (typeof body !== 'object' || body === null) return false;
  const obj = body as Record<string, unknown>;
  return (
    typeof obj.email === 'string' &&
    obj.email.includes('@') &&
    typeof obj.firstName === 'string' &&
    typeof obj.lastName === 'string'
  );
}

interface BulkRecipientsBody {
  recipients: CreateRecipientBody[];
}

// ============================================
// CAMPAIGN RECIPIENT ROUTES
// ============================================

router.get('/campaigns/:id/recipients', asyncHandler(async (req: Request, res: Response) => {
  const recipients = await getRecipientsByCampaign(req.params.id);
  sendSuccess(res, recipients);
}));

router.post('/campaigns/:id/recipients', asyncHandler(async (req: Request, res: Response) => {
  if (!isValidRecipientBody(req.body)) { sendError(res, 400, 'Invalid request body'); return; }

  const recipient = await createRecipient({
    campaignId: req.params.id,
    email: req.body.email.trim(),
    firstName: req.body.firstName.trim(),
    lastName: req.body.lastName.trim(),
  });

  sendSuccess(res, recipient, 201);
}));

router.post('/campaigns/:id/recipients/bulk', asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as BulkRecipientsBody;
  if (!Array.isArray(body.recipients) || body.recipients.length === 0) {
    sendError(res, 400, 'Invalid request body');
    return;
  }

  const validRecipients = body.recipients.filter(isValidRecipientBody).map((r) => ({
    email: r.email.trim(),
    firstName: r.firstName.trim(),
    lastName: r.lastName.trim(),
  }));

  if (validRecipients.length === 0) {
    sendError(res, 400, 'No valid recipients provided');
    return;
  }

  const count = await createRecipientsBulk(req.params.id, validRecipients);
  sendSuccess(res, { count }, 201);
}));

// ============================================
// STANDALONE RECIPIENT ROUTES
// ============================================

router.delete('/recipients/:id', asyncHandler(async (req: Request, res: Response) => {
  const deleted = await deleteRecipient(req.params.id);
  if (!deleted) { sendError(res, 404, 'Recipient not found'); return; }
  sendSuccess(res, null);
}));

router.get('/recipients/token/:token', asyncHandler(async (req: Request, res: Response) => {
  const recipient = await getRecipientByToken(req.params.token);
  if (!recipient) { sendError(res, 404, 'Recipient not found'); return; }
  sendSuccess(res, recipient);
}));

router.patch('/recipients/token/:token/status', asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body as { status: string };
  const validStatuses: RecipientStatus[] = ['pending', 'sent', 'clicked', 'submitted', 'failed'];
  if (!validStatuses.includes(status as RecipientStatus)) {
    sendError(res, 400, 'Invalid status');
    return;
  }

  const recipient = await updateRecipientStatus(req.params.token, status as RecipientStatus);
  if (!recipient) { sendError(res, 404, 'Recipient not found'); return; }
  sendSuccess(res, recipient);
}));

export default router;
