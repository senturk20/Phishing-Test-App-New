import { Queue } from 'bullmq';
import { config } from '../config.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('QueueService');

// ============================================
// JOB DATA INTERFACE
// ============================================

export interface EmailJobData {
  recipientToken: string;
  recipientEmail: string;
  subject: string;
  html: string;
  campaignId: string;
  campaignName: string;
}

// ============================================
// REDIS CONNECTION OPTIONS
// ============================================

function getRedisOpts() {
  return {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password || undefined,
    tls: config.redis.tls ? {} : undefined,
    maxRetriesPerRequest: null as null, // Required by BullMQ
    enableReadyCheck: false,
  };
}

// Export for mailWorker to reuse
export { getRedisOpts };

// ============================================
// QUEUE INSTANCE
// ============================================

export const QUEUE_NAME = 'email-sending';

let emailQueue: Queue | null = null;

function getEmailQueue(): Queue {
  if (!emailQueue) {
    emailQueue = new Queue(QUEUE_NAME, {
      connection: getRedisOpts(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // 5s -> 10s -> 20s
        },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }
  return emailQueue;
}

// ============================================
// PUBLIC API
// ============================================

let redisAvailable: boolean | null = null;
let redisCheckedAt = 0;
const REDIS_CACHE_TTL = 30_000; // re-check every 30s so a late-starting Redis gets picked up

export async function isRedisAvailable(): Promise<boolean> {
  if (config.useMemoryDb) return false;

  const now = Date.now();
  // Return cached result if it's fresh and was true (success).
  // If the last check failed, allow a re-check after TTL so Redis
  // can be discovered once it comes online.
  if (redisAvailable !== null && (redisAvailable || now - redisCheckedAt < REDIS_CACHE_TTL)) {
    return redisAvailable;
  }

  try {
    // Race the connection test against a 3-second timeout so we never
    // hang the event loop waiting for an unreachable Redis.
    const testQueue = new Queue('__test_connection', {
      connection: getRedisOpts(),
    });
    await Promise.race([
      testQueue.close(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 3000)),
    ]);
    redisAvailable = true;
    redisCheckedAt = now;
    log.info('Redis connection established');
  } catch {
    redisAvailable = false;
    redisCheckedAt = now;
    log.warn('Redis not available, falling back to direct send');
  }
  return redisAvailable;
}

export async function enqueueEmailBatch(jobs: EmailJobData[]): Promise<void> {
  const queue = getEmailQueue();
  await queue.addBulk(
    jobs.map((data) => ({
      name: 'send-email',
      data,
      opts: {
        jobId: `email-${data.recipientToken}`,
      },
    }))
  );
}

/**
 * Enqueue emails with individual per-recipient delays (for spread mode).
 * Each job gets a BullMQ `delay` in milliseconds so it stays in the
 * "delayed" state until its scheduled send time arrives.
 */
export async function enqueueEmailWithDelay(
  jobs: Array<{ data: EmailJobData; delayMs: number }>
): Promise<void> {
  const queue = getEmailQueue();
  await queue.addBulk(
    jobs.map(({ data, delayMs }) => ({
      name: 'send-email',
      data,
      opts: {
        jobId: `email-${data.recipientToken}`,
        delay: delayMs,
      },
    }))
  );
}

export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const queue = getEmailQueue();
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);
  return { waiting, active, completed, failed, delayed };
}

export async function closeQueue(): Promise<void> {
  if (emailQueue) {
    await emailQueue.close();
    emailQueue = null;
  }
}
