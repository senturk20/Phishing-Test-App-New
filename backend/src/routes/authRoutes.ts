import { Router, Request, Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { config } from '../config.js';
import { getAdminByUsername, verifyPassword } from '../services/adminService.js';
import { verifyToken } from '../middleware/auth.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/asyncHandler.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('Auth');
const router = Router();

// ============================================
// POST /auth/login
// ============================================

router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    sendError(res, 400, 'Username and password are required');
    return;
  }

  const admin = await getAdminByUsername(username);
  if (!admin) {
    sendError(res, 401, 'Invalid credentials');
    return;
  }

  const valid = await verifyPassword(password, admin.passwordHash);
  if (!valid) {
    sendError(res, 401, 'Invalid credentials');
    return;
  }

  const signOptions = { expiresIn: config.jwt.expiresIn } as SignOptions;
  const token = jwt.sign(
    { id: admin.id, username: admin.username, role: admin.role },
    config.jwt.secret,
    signOptions
  );

  log.info('Login successful', { username: admin.username });

  sendSuccess(res, {
    token,
    admin: {
      id: admin.id,
      username: admin.username,
      role: admin.role,
    },
  });
}));

// ============================================
// GET /auth/me  (protected)
// ============================================

router.get('/me', verifyToken, (req: Request, res: Response) => {
  sendSuccess(res, { admin: req.admin });
});

export default router;
