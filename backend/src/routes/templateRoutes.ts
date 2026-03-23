import { Router, Request, Response } from 'express';
import {
  getEmailTemplates,
  getEmailTemplate,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
} from '../services/index.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/asyncHandler.js';

const router = Router();

// ============================================
// VALIDATION
// ============================================

interface CreateTemplateBody {
  name: string;
  subject: string;
  body: string;
  category?: string;
  isDefault?: boolean;
}

function isValidTemplateBody(body: unknown): body is CreateTemplateBody {
  if (typeof body !== 'object' || body === null) return false;
  const obj = body as Record<string, unknown>;
  return (
    typeof obj.name === 'string' &&
    obj.name.trim().length > 0 &&
    typeof obj.subject === 'string' &&
    typeof obj.body === 'string'
  );
}

// ============================================
// ROUTES
// ============================================

router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const templates = await getEmailTemplates();
  sendSuccess(res, templates);
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const template = await getEmailTemplate(req.params.id);
  if (!template) { sendError(res, 404, 'Template not found'); return; }
  sendSuccess(res, template);
}));

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  if (!isValidTemplateBody(req.body)) { sendError(res, 400, 'Invalid request body'); return; }

  const template = await createEmailTemplate({
    name: req.body.name.trim(),
    subject: req.body.subject,
    body: req.body.body,
    category: req.body.category,
    isDefault: req.body.isDefault,
  });

  sendSuccess(res, template, 201);
}));

router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as Partial<CreateTemplateBody>;
  const template = await updateEmailTemplate(req.params.id, {
    name: body.name?.trim(),
    subject: body.subject,
    body: body.body,
    category: body.category,
    isDefault: body.isDefault,
  });
  if (!template) { sendError(res, 404, 'Template not found'); return; }
  sendSuccess(res, template);
}));

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const deleted = await deleteEmailTemplate(req.params.id);
  if (!deleted) { sendError(res, 404, 'Template not found'); return; }
  sendSuccess(res, null);
}));

export default router;
