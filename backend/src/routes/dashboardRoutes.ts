import { Router, Request, Response, NextFunction } from 'express';
import { getDashboardStats, getDepartmentStats, getAllRecipients } from '../services/index.js';

const router = Router();

// ============================================
// ROUTES
// ============================================

// Get dashboard stats
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await getDashboardStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// Get department vulnerability stats
router.get('/departments', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await getDepartmentStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// Get all users (paginated, cross-campaign, deduplicated by email)
router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await getAllRecipients({
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 25,
      faculty: (req.query.faculty as string) || undefined,
      search: (req.query.search as string) || undefined,
      status: (req.query.status as string) || undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
