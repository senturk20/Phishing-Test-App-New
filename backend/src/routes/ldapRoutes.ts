import { Router, Request, Response, NextFunction } from 'express';
import {
  testLdapConnection,
  getLdapUsersPreview,
  syncLdapUsersToCampaign,
  syncLdapFacultyToCampaign,
  searchLdapUsersByFaculty,
} from '../services/index.js';

const router = Router();

// ============================================
// ROUTES
// ============================================

// Test LDAP connection
router.get('/test', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const connected = await testLdapConnection();
    res.json({
      success: connected,
      message: connected ? 'LDAP connection successful' : 'LDAP connection failed',
    });
  } catch (err) {
    next(err);
  }
});

// Preview LDAP users (without syncing) — optional ?faculty= filter
router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const faculty = req.query.faculty as string | undefined;
    const result = await getLdapUsersPreview();

    if (faculty && faculty !== 'all') {
      const filtered = result.users.filter(u => u.faculty.toLowerCase() === faculty.toLowerCase());
      res.json({ ...result, users: filtered, count: filtered.length });
    } else {
      res.json(result);
    }
  } catch (err) {
    next(err);
  }
});

// List available faculties (derived from LDAP users)
router.get('/faculties', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await getLdapUsersPreview();
    const facultyMap = new Map<string, number>();
    for (const user of result.users) {
      const fac = user.faculty || 'unknown';
      facultyMap.set(fac, (facultyMap.get(fac) || 0) + 1);
    }
    const faculties = Array.from(facultyMap.entries()).map(([name, count]) => ({ name, count }));
    res.json({ faculties, total: result.count });
  } catch (err) {
    next(err);
  }
});

// Sync LDAP users to a campaign — optional ?faculty= filter
router.post('/sync/:campaignId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { campaignId } = req.params;
    const faculty = (req.body.faculty || req.query.faculty || 'all') as string;

    if (!campaignId) {
      res.status(400).json({ error: 'Campaign ID is required' });
      return;
    }

    const result = faculty && faculty !== 'all'
      ? await syncLdapFacultyToCampaign(campaignId, faculty)
      : await syncLdapUsersToCampaign(campaignId);

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
