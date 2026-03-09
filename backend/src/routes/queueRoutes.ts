import { Router, Request, Response, NextFunction } from 'express';
import { getQueueStats, isRedisAvailable } from '../services/queueService.js';

const router = Router();

// GET /queue/stats — Queue health dashboard
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const available = await isRedisAvailable();
    if (!available) {
      res.json({
        enabled: false,
        message: 'Queue system not available (Redis not connected or memory mode)',
      });
      return;
    }

    const stats = await getQueueStats();
    res.json({
      enabled: true,
      queue: 'email-sending',
      ...stats,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
