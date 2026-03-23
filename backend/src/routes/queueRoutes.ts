import { Router, Request, Response } from 'express';
import { getQueueStats, isRedisAvailable } from '../services/queueService.js';
import { asyncHandler, sendSuccess } from '../utils/asyncHandler.js';

const router = Router();

router.get('/stats', asyncHandler(async (_req: Request, res: Response) => {
  const available = await isRedisAvailable();
  if (!available) {
    sendSuccess(res, {
      enabled: false,
      message: 'Queue system not available (Redis not connected or memory mode)',
    });
    return;
  }

  const stats = await getQueueStats();
  sendSuccess(res, { enabled: true, queue: 'email-sending', ...stats });
}));

export default router;
