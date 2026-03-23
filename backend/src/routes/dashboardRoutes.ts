import { Router, Request, Response } from 'express';
import { getDashboardStats, getDepartmentStats, getAllRecipients } from '../services/index.js';
import { asyncHandler, sendSuccess } from '../utils/asyncHandler.js';

const router = Router();

router.get('/stats', asyncHandler(async (_req: Request, res: Response) => {
  const stats = await getDashboardStats();
  sendSuccess(res, stats);
}));

router.get('/departments', asyncHandler(async (_req: Request, res: Response) => {
  const stats = await getDepartmentStats();
  sendSuccess(res, stats);
}));

router.get('/users', asyncHandler(async (req: Request, res: Response) => {
  const result = await getAllRecipients({
    page: parseInt(req.query.page as string) || 1,
    pageSize: parseInt(req.query.pageSize as string) || 25,
    faculty: (req.query.faculty as string) || undefined,
    search: (req.query.search as string) || undefined,
    status: (req.query.status as string) || undefined,
  });
  sendSuccess(res, result);
}));

export default router;
