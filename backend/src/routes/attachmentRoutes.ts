import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getAttachments, getAttachment, createAttachment, deleteAttachment } from '../services/attachmentService.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/asyncHandler.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('Attachment');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_DIR = path.join(__dirname, '../../static/uploads');

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
  limits: { fileSize: 25 * 1024 * 1024 },
});

const router = Router();

router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const attachments = await getAttachments();
  sendSuccess(res, attachments);
}));

router.post('/upload', upload.single('file'), asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) { sendError(res, 400, 'No file uploaded'); return; }

  const attachment = await createAttachment({
    originalName: req.file.originalname,
    storedName: req.file.filename,
    mimeType: req.file.mimetype,
    size: req.file.size,
  });

  log.info('Uploaded', { name: attachment.originalName, size: `${(attachment.size / 1024).toFixed(1)}KB` });
  sendSuccess(res, attachment, 201);
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const attachment = await getAttachment(req.params.id);
  if (!attachment) { sendError(res, 404, 'Attachment not found'); return; }
  sendSuccess(res, attachment);
}));

router.get('/:id/download', asyncHandler(async (req: Request, res: Response) => {
  const attachment = await getAttachment(req.params.id);
  if (!attachment) { sendError(res, 404, 'Attachment not found'); return; }

  const filePath = path.join(UPLOAD_DIR, attachment.storedName);
  if (!fs.existsSync(filePath)) { sendError(res, 404, 'File not found on disk'); return; }

  res.download(filePath, attachment.originalName);
}));

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const attachment = await getAttachment(req.params.id);
  if (attachment) {
    const filePath = path.join(UPLOAD_DIR, attachment.storedName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  const deleted = await deleteAttachment(req.params.id);
  if (!deleted) { sendError(res, 404, 'Attachment not found'); return; }
  sendSuccess(res, null);
}));

export default router;
