import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { config } from '../config.js';
import { sendEmail } from './mailService.js';
import { updateRecipientStatus } from './recipientService.js';
import { QUEUE_NAME, getRedisOpts } from './queueService.js';
import type { EmailJobData } from './queueService.js';

// ============================================
// MAIL WORKER
// ============================================

let worker: Worker | null = null;

export function startMailWorker(): void {
  if (worker) {
    console.warn('[MailWorker] Already running');
    return;
  }

  worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      const { recipientToken, recipientEmail, subject, html, campaignName } = job.data as EmailJobData;

      console.log(`[MailWorker] Processing job ${job.id} | Campaign: ${campaignName} | To: ${recipientEmail}`);

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
    console.log(`[MailWorker] Sent to ${data.recipientEmail}`);
  });

  worker.on('failed', (job, err) => {
    if (!job) return;
    const data = job.data as EmailJobData;
    console.error(`[MailWorker] Job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts?.attempts || 3}):`, err.message);

    // On final failure, mark recipient as 'failed'
    if (job.attemptsMade >= (job.opts?.attempts || 3)) {
      updateRecipientStatus(data.recipientToken, 'failed').catch((e) =>
        console.error(`[MailWorker] Failed to update status for ${data.recipientEmail}:`, e)
      );
    }
  });

  worker.on('error', (err) => {
    console.error('[MailWorker] Worker error:', err);
  });

  console.log(
    `[MailWorker] Started | concurrency: ${config.queue.concurrency} | rate limit: ${config.queue.rateMax}/${config.queue.rateDuration}ms`
  );
}

export async function stopMailWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    console.log('[MailWorker] Stopped');
  }
}
