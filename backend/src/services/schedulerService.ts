import type { Campaign } from '../types/index.js';
import { config } from '../config.js';
import { getPool, memoryStore } from '../db/index.js';
import { completeCampaign } from './campaignService.js';

// ============================================
// DAY MAPPING
// ============================================

const DAY_MAP: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// ============================================
// TIME HELPERS
// ============================================

function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [h, m] = timeStr.split(':').map(Number);
  return { hours: h || 0, minutes: m || 0 };
}

function setTime(date: Date, hours: number, minutes: number): Date {
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/**
 * Check if the given date falls on a configured work day.
 */
function isWorkDay(date: Date, businessDays: string[]): boolean {
  const dayName = DAY_NAMES[date.getDay()];
  return businessDays.includes(dayName);
}

/**
 * Check if the given date/time is within work hours.
 */
function isWithinWorkHours(
  date: Date,
  startTime: string,
  endTime: string,
): boolean {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  const current = date.getHours() * 60 + date.getMinutes();
  const startMin = start.hours * 60 + start.minutes;
  const endMin = end.hours * 60 + end.minutes;
  return current >= startMin && current < endMin;
}

/**
 * Given a date that may be outside business hours / non-work day,
 * advance it to the start of the next valid work slot.
 */
function advanceToNextWorkSlot(
  date: Date,
  businessDays: string[],
  startTime: string,
  endTime: string,
): Date {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  let d = new Date(date);

  // If current time is past end-of-day, move to next calendar day at startTime
  const currentMin = d.getHours() * 60 + d.getMinutes();
  const endMin = end.hours * 60 + end.minutes;
  if (currentMin >= endMin) {
    d.setDate(d.getDate() + 1);
    d = setTime(d, start.hours, start.minutes);
  }

  // If current time is before start-of-day, snap to startTime same day
  const startMin = start.hours * 60 + start.minutes;
  const cur2 = d.getHours() * 60 + d.getMinutes();
  if (cur2 < startMin) {
    d = setTime(d, start.hours, start.minutes);
  }

  // Now advance day-by-day until we land on a work day (max 14 days safety)
  for (let i = 0; i < 14; i++) {
    if (isWorkDay(d, businessDays)) {
      return d;
    }
    d.setDate(d.getDate() + 1);
    d = setTime(d, start.hours, start.minutes);
  }

  // Fallback: return as-is (should not happen with valid config)
  return d;
}

// ============================================
// CALCULATE NEXT SEND TIME
// ============================================

/**
 * Calculate the send time for the Nth email in a spread campaign.
 *
 * Formula:
 *   totalWorkMinutes = workHoursPerDay × spreadDays (or spreadHours × 60)
 *   interval = totalWorkMinutes / totalRecipients
 *   offsetMinutes = interval × currentIndex
 *
 * Each computed time is then validated against business hours & work days.
 * If it falls outside, it jumps to the next valid work slot.
 */
export function calculateNextSendTime(
  settings: {
    startDate?: string;
    startTime?: string;
    sendingMode: string;
    spreadDays: number;
    spreadUnit: string;
    businessHoursStart: string;
    businessHoursEnd: string;
    businessDays: string[];
  },
  currentIndex: number,
  totalRecipients: number,
): Date {
  // Base start time
  const now = new Date();
  let baseTime: Date;

  if (settings.startDate && settings.startTime) {
    const start = parseTime(settings.startTime);
    baseTime = new Date(`${settings.startDate}T00:00:00`);
    baseTime = setTime(baseTime, start.hours, start.minutes);
    // If configured start is in the past, use now
    if (baseTime < now) {
      baseTime = now;
    }
  } else {
    baseTime = now;
  }

  // For 'all' mode, everyone sends ASAP (no spread)
  if (settings.sendingMode !== 'spread') {
    return baseTime;
  }

  // Calculate work minutes per day
  const bhStart = parseTime(settings.businessHoursStart);
  const bhEnd = parseTime(settings.businessHoursEnd);
  const workMinutesPerDay = (bhEnd.hours * 60 + bhEnd.minutes) - (bhStart.hours * 60 + bhStart.minutes);

  if (workMinutesPerDay <= 0 || totalRecipients <= 0) {
    return baseTime;
  }

  // Total work minutes in the spread window
  let totalWorkMinutes: number;
  if (settings.spreadUnit === 'hours') {
    totalWorkMinutes = settings.spreadDays * 60; // spreadDays is actually hours here
  } else {
    // 'days' — number of business days
    totalWorkMinutes = workMinutesPerDay * settings.spreadDays;
  }

  // Interval between each email (in minutes)
  const intervalMinutes = totalWorkMinutes / totalRecipients;

  // Offset for this specific recipient
  const offsetMinutes = intervalMinutes * currentIndex;

  // Snap base time to the first valid work slot
  const workStart = advanceToNextWorkSlot(
    baseTime,
    settings.businessDays,
    settings.businessHoursStart,
    settings.businessHoursEnd,
  );

  // Walk forward by offsetMinutes through work-time-only slots
  let sendTime = new Date(workStart);
  let remainingMinutes = offsetMinutes;

  while (remainingMinutes > 0) {
    // How many work minutes remain today?
    const todayEnd = setTime(sendTime, bhEnd.hours, bhEnd.minutes);
    const minutesLeftToday = Math.max(0,
      (todayEnd.getTime() - sendTime.getTime()) / 60000
    );

    if (remainingMinutes <= minutesLeftToday) {
      // Fits within today
      sendTime = new Date(sendTime.getTime() + remainingMinutes * 60000);
      remainingMinutes = 0;
    } else {
      // Consume the rest of today, advance to next work day
      remainingMinutes -= minutesLeftToday;
      sendTime.setDate(sendTime.getDate() + 1);
      sendTime = setTime(sendTime, bhStart.hours, bhStart.minutes);
      sendTime = advanceToNextWorkSlot(
        sendTime,
        settings.businessDays,
        settings.businessHoursStart,
        settings.businessHoursEnd,
      );
    }
  }

  return sendTime;
}

/**
 * Calculate BullMQ delay (milliseconds from now) for each recipient.
 * Returns an array of delays in ms, one per recipient index.
 */
export function calculateSendDelays(
  campaign: Campaign,
  totalRecipients: number,
): number[] {
  const now = Date.now();
  const delays: number[] = [];

  for (let i = 0; i < totalRecipients; i++) {
    const sendTime = calculateNextSendTime(campaign, i, totalRecipients);
    const delayMs = Math.max(0, sendTime.getTime() - now);
    delays.push(delayMs);

    // Log the first, last, and every 50th recipient for verification
    if (i === 0 || i === totalRecipients - 1 || i % 50 === 0) {
      console.log(
        `[Scheduler] Campaign "${campaign.name}" — email ${i + 1}/${totalRecipients} ` +
        `scheduled for: ${sendTime.toISOString()} (delay: ${Math.round(delayMs / 1000)}s)`
      );
    }
  }

  return delays;
}

// ============================================
// CAMPAIGN COMPLETION CHECKER
// ============================================

let completionTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Check active campaigns and auto-complete them once:
 *   1. All emails have been sent (no 'pending' recipients)
 *   2. trackActivityDays have elapsed since the last email was sent
 */
async function checkCampaignCompletions(): Promise<void> {
  try {
    if (config.useMemoryDb) {
      const activeCampaigns = memoryStore.campaigns.filter(c => c.status === 'active');
      const now = new Date();

      for (const campaign of activeCampaigns) {
        const recipients = memoryStore.recipients.filter(r => r.campaignId === campaign.id);
        const pendingCount = recipients.filter(r => r.status === 'pending').length;

        if (pendingCount > 0) continue; // Still sending

        // Find the latest sentAt timestamp
        const sentTimes = recipients
          .filter(r => r.sentAt)
          .map(r => new Date(r.sentAt!).getTime());

        if (sentTimes.length === 0) continue;

        const lastSentAt = new Date(Math.max(...sentTimes));
        const trackDays = campaign.trackActivityDays || 7;
        const expiryDate = new Date(lastSentAt.getTime() + trackDays * 24 * 60 * 60 * 1000);

        if (now >= expiryDate) {
          console.log(
            `[Scheduler] Campaign "${campaign.name}" — activity tracking period expired ` +
            `(last sent: ${lastSentAt.toISOString()}, track: ${trackDays}d). Auto-completing.`
          );
          await completeCampaign(campaign.id);
        } else {
          const remainingHours = Math.round((expiryDate.getTime() - now.getTime()) / 3600000);
          console.log(
            `[Scheduler] Campaign "${campaign.name}" — tracking active, ` +
            `${remainingHours}h remaining until auto-complete`
          );
        }
      }
      return;
    }

    // PostgreSQL mode
    const p = await getPool();
    if (!p) return;

    // Find active campaigns where all recipients have been sent
    const result = await p.query(`
      SELECT c.id, c.name, c.track_activity_days,
             COUNT(r.id) AS total_recipients,
             COUNT(CASE WHEN r.status = 'pending' THEN 1 END) AS pending_count,
             MAX(r.sent_at) AS last_sent_at
      FROM campaigns c
      JOIN recipients r ON r.campaign_id = c.id
      WHERE c.status = 'active'
      GROUP BY c.id, c.name, c.track_activity_days
      HAVING COUNT(CASE WHEN r.status = 'pending' THEN 1 END) = 0
    `);

    const now = new Date();

    for (const row of result.rows) {
      if (!row.last_sent_at) continue;

      const lastSentAt = new Date(row.last_sent_at);
      const trackDays = row.track_activity_days || 7;
      const expiryDate = new Date(lastSentAt.getTime() + trackDays * 24 * 60 * 60 * 1000);

      if (now >= expiryDate) {
        console.log(
          `[Scheduler] Campaign "${row.name}" (${row.id}) — activity tracking period expired ` +
          `(last sent: ${lastSentAt.toISOString()}, track: ${trackDays}d). Auto-completing.`
        );
        await completeCampaign(row.id);
      } else {
        const remainingHours = Math.round((expiryDate.getTime() - now.getTime()) / 3600000);
        console.log(
          `[Scheduler] Campaign "${row.name}" — tracking active, ` +
          `${remainingHours}h remaining until auto-complete`
        );
      }
    }
  } catch (err) {
    console.error('[Scheduler] Error checking campaign completions:', err);
  }
}

/**
 * Start the periodic completion checker (runs every 60 seconds).
 */
export function startCompletionChecker(): void {
  if (completionTimer) return;

  console.log('[Scheduler] Campaign completion checker started (interval: 60s)');
  // Run immediately on start, then every 60s
  checkCampaignCompletions();
  completionTimer = setInterval(checkCampaignCompletions, 60_000);
}

export function stopCompletionChecker(): void {
  if (completionTimer) {
    clearInterval(completionTimer);
    completionTimer = null;
    console.log('[Scheduler] Campaign completion checker stopped');
  }
}
