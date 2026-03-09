import { Router, Request, Response, NextFunction } from 'express';
import {
  getEmailTemplates,
  getEmailTemplate,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
} from '../services/index.js';

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

// List all templates
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const templates = await getEmailTemplates();
    res.json(templates);
  } catch (err) {
    next(err);
  }
});

// Get single template
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await getEmailTemplate(req.params.id);
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    res.json(template);
  } catch (err) {
    next(err);
  }
});

// Create template
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isValidTemplateBody(req.body)) {
      res.status(400).json({ error: 'Invalid request body' });
      return;
    }

    const template = await createEmailTemplate({
      name: req.body.name.trim(),
      subject: req.body.subject,
      body: req.body.body,
      category: req.body.category,
      isDefault: req.body.isDefault,
    });

    res.status(201).json(template);
  } catch (err) {
    next(err);
  }
});

// Update template
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as Partial<CreateTemplateBody>;
    const template = await updateEmailTemplate(req.params.id, {
      name: body.name?.trim(),
      subject: body.subject,
      body: body.body,
      category: body.category,
      isDefault: body.isDefault,
    });
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    res.json(template);
  } catch (err) {
    next(err);
  }
});

// Delete template
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await deleteEmailTemplate(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
