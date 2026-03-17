import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getAttachments, getAttachment, createAttachment, deleteAttachment } from '../services/attachmentService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_DIR = path.join(__dirname, '../../static/uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

const router = Router();

// ============================================
// GET /attachments — list all
// ============================================
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const attachments = await getAttachments();
    res.json(attachments);
  } catch (err) {
    next(err);
  }
});

// ============================================
// POST /attachments/upload — upload a file
// ============================================
router.post('/upload', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const attachment = await createAttachment({
      originalName: req.file.originalname,
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });

    console.log(`[Attachment] Uploaded: ${attachment.originalName} (${(attachment.size / 1024).toFixed(1)}KB)`);
    res.status(201).json(attachment);
  } catch (err) {
    next(err);
  }
});

// ============================================
// GET /attachments/:id — get metadata
// ============================================
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attachment = await getAttachment(req.params.id);
    if (!attachment) {
      res.status(404).json({ error: 'Attachment not found' });
      return;
    }
    res.json(attachment);
  } catch (err) {
    next(err);
  }
});

// ============================================
// GET /attachments/:id/download — serve the file
// ============================================
router.get('/:id/download', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attachment = await getAttachment(req.params.id);
    if (!attachment) {
      res.status(404).json({ error: 'Attachment not found' });
      return;
    }

    const filePath = path.join(UPLOAD_DIR, attachment.storedName);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found on disk' });
      return;
    }

    res.download(filePath, attachment.originalName);
  } catch (err) {
    next(err);
  }
});

// ============================================
// DELETE /attachments/:id
// ============================================
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attachment = await getAttachment(req.params.id);
    if (attachment) {
      const filePath = path.join(UPLOAD_DIR, attachment.storedName);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    const deleted = await deleteAttachment(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Attachment not found' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
