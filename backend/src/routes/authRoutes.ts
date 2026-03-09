import { Router, Request, Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { config } from '../config.js';
import { getAdminByUsername, verifyPassword } from '../services/adminService.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

// ============================================
// POST /auth/login
// ============================================

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const admin = await getAdminByUsername(username);
    if (!admin) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await verifyPassword(password, admin.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const signOptions = { expiresIn: config.jwt.expiresIn } as SignOptions;
    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: admin.role },
      config.jwt.secret,
      signOptions
    );

    res.json({
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        role: admin.role,
      },
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// GET /auth/me  (protected)
// ============================================

router.get('/me', verifyToken, (req: Request, res: Response) => {
  res.json({
    admin: req.admin,
  });
});

export default router;
