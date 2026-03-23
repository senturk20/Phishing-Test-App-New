import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { config } from '../config.js';
import { sendEmail } from './mailService.js';
import { updateRecipientStatus } from './recipientService.js';
import { QUEUE_NAME, getRedisOpts } from './queueService.js';
import type { EmailJobData } from './queueService.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('MailWorker');

// ============================================
// MAIL WORKER
// ============================================

let worker: Worker | null = null;

export function startMailWorker(): void {
  if (worker) {
    log.warn('Already running');
    return;
  }

  worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      const { recipientToken, recipientEmail, subject, html, campaignName } = job.data as EmailJobData;

      log.info('Processing job', { jobId: job.id, campaignName, to: recipientEmail });

      // Anti-spam jitter: random delay 2-5 seconds before each send
      const jitter = 2000 + Math.random() * 3000;
      await new Promise<void>((resolve) => setTimeout(resolve, jitter));

      const success = await sendEmail({ to: recipientEmail, subject, html });

      if (success) {
        await updateRecipientStatus(recipientToken, 'sent');
      } else {
        throw new Error(`sendEmail returned false for ${recipientEmail}`);
      }
    },
    {
      connection: getRedisOpts(),
      concurrency: config.queue.concurrency,
      limiter: {
        max: config.queue.rateMax,
        duration: config.queue.rateDuration,
      },
    }
  );

  // ============================================
  // WORKER EVENTS
  // ============================================

  worker.on('completed', (job) => {
    const data = job.data as EmailJobData;
    log.info('Sent', { to: data.recipientEmail });
  });

  worker.on('failed', (job, err) => {
    if (!job) return;
    const data = job.data as EmailJobData;
    log.error('Job failed', { jobId: job.id, attempt: job.attemptsMade, maxAttempts: job.opts?.attempts || 3, error: err.message });

    // On final failure, mark recipient as 'failed'
    if (job.attemptsMade >= (job.opts?.attempts || 3)) {
      updateRecipientStatus(data.recipientToken, 'failed').catch((e) =>
        log.error('Failed to update status', { to: data.recipientEmail, error: String(e) })
      );
    }
  });

  worker.on('error', (err) => {
    log.error('Worker error', { error: String(err) });
  });

  log.info('Started', { concurrency: config.queue.concurrency, rateMax: config.queue.rateMax, rateDuration: config.queue.rateDuration });
}

export async function stopMailWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    log.info('Stopped');
  }
}
