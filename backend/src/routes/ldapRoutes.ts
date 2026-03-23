import { Router, Request, Response } from 'express';
import {
  testLdapConnection,
  getLdapUsersPreview,
  syncLdapUsersToCampaign,
  syncLdapFacultyToCampaign,
} from '../services/index.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/asyncHandler.js';

const router = Router();

router.get('/test', asyncHandler(async (_req: Request, res: Response) => {
  const connected = await testLdapConnection();
  sendSuccess(res, {
    connected,
    message: connected ? 'LDAP connection successful' : 'LDAP connection failed',
  });
}));

router.get('/users', asyncHandler(async (req: Request, res: Response) => {
  const faculty = req.query.faculty as string | undefined;
  const result = await getLdapUsersPreview();

  if (faculty && faculty !== 'all') {
    const filtered = result.users.filter(u => u.faculty.toLowerCase() === faculty.toLowerCase());
    sendSuccess(res, { ...result, users: filtered, count: filtered.length });
  } else {
    sendSuccess(res, result);
  }
}));

router.get('/faculties', asyncHandler(async (_req: Request, res: Response) => {
  const result = await getLdapUsersPreview();
  const facultyMap = new Map<string, number>();
  for (const user of result.users) {
    const fac = user.faculty || 'unknown';
    facultyMap.set(fac, (facultyMap.get(fac) || 0) + 1);
  }
  const faculties = Array.from(facultyMap.entries()).map(([name, count]) => ({ name, count }));
  sendSuccess(res, { faculties, total: result.count });
}));

router.post('/sync/:campaignId', asyncHandler(async (req: Request, res: Response) => {
  const { campaignId } = req.params;
  const faculty = (req.body.faculty || req.query.faculty || 'all') as string;

  if (!campaignId) { sendError(res, 400, 'Campaign ID is required'); return; }

  const result = faculty && faculty !== 'all'
    ? await syncLdapFacultyToCampaign(campaignId, faculty)
    : await syncLdapUsersToCampaign(campaignId);

  sendSuccess(res, result);
}));

export default router;
