import { config } from '../config.js';
import { getPool, memoryStore, generateId } from '../db/index.js';
import type { Campaign, CampaignStats } from '../types/index.js';
import { getRecipientsByCampaign, updateRecipientStatus } from './recipientService.js';
import { getEmailTemplate, getEmailTemplates } from './templateService.js';
import { sendEmail } from './mailService.js';
import { isRedisAvailable, enqueueEmailBatch } from './queueService.js';
import type { EmailJobData } from './queueService.js';
import pLimit from 'p-limit';

// ============================================
// PLACEHOLDER HELPER
// ============================================

function replacePlaceholders(
  text: string,
  recipient: { firstName: string; lastName: string; email: string },
  trackingLink: string,
  phishDomain: string
): string {
  const fullName = [recipient.firstName, recipient.lastName].filter(Boolean).join(' ');
  return text
    .replace(/\{\{firstName\}\}/g, recipient.firstName || '')
    .replace(/\{\{lastName\}\}/g, recipient.lastName || '')
    .replace(/\{\{name\}\}/g, fullName)
    .replace(/\{\{trackingLink\}\}/g, trackingLink)
    .replace(/\{\{link\}\}/g, trackingLink)
    .replace(/\{\{email\}\}/g, recipient.email)
    .replace(/\{\{phish_domain\}\}/g, phishDomain)
    .replace(/\{\{department\}\}/g, '')
    .replace(/\{\{date\}\}/g, new Date().toLocaleDateString('tr-TR'));
}

// Append a stealth 1x1 tracking pixel to email HTML for open detection
function injectTrackingPixel(html: string, trackingBase: string, recipientToken: string): string {
  const pixelUrl = `${trackingBase}/static/images/footer-header.png?t=${recipientToken}`;
  const pixelTag = `<img src="${pixelUrl}" width="1" height="1" style="display:none;" alt="" />`;
  // Insert before </body> if present, otherwise append at end
  if (html.includes('</body>')) {
    return html.replace('</body>', `${pixelTag}</body>`);
  }
  return html + pixelTag;
}

// ============================================
// GET CAMPAIGNS
// ============================================

export async function getCampaigns(): Promise<Campaign[]> {
  if (config.useMemoryDb) {
    return [...memoryStore.campaigns]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(c => ({
        ...c,
        targetCount: memoryStore.recipients.filter(r => r.campaignId === c.id).length || c.targetCount,
      }));
  }

  const p = await getPool();
  if (!p) return [];

  const result = await p.query(
    `SELECT c.*,
       (SELECT COUNT(*) FROM recipients r WHERE r.campaign_id = c.id) AS actual_recipient_count
     FROM campaigns c
     ORDER BY c.created_at DESC`
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    targetCount: parseInt(row.actual_recipient_count, 10) || row.target_count || 0,
    frequency: row.frequency,
    startDate: row.start_date,
    startTime: row.start_time,
    timezone: row.timezone,
    sendingMode: row.sending_mode,
    spreadDays: row.spread_days,
    spreadUnit: row.spread_unit,
    businessHoursStart: row.business_hours_start,
    businessHoursEnd: row.business_hours_end,
    businessDays: JSON.parse(row.business_days || '[]'),
    trackActivityDays: row.track_activity_days,
    category: row.category,
    templateMode: row.template_mode,
    templateId: row.template_id,
    phishDomain: row.phish_domain,
    landingPageId: row.landing_page_id,
    addClickersToGroup: row.add_clickers_to_group,
    sendReportEmail: row.send_report_email,
    nextRunAt: row.next_run_at,
    lastRunAt: row.last_run_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

// ============================================
// GET CAMPAIGN
// ============================================

export async function getCampaign(id: string): Promise<Campaign | null> {
  if (config.useMemoryDb) {
    return memoryStore.campaigns.find((c) => c.id === id) || null;
  }

  const p = await getPool();
  if (!p) return null;

  const result = await p.query(
    `SELECT * FROM campaigns WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    targetCount: row.target_count,
    frequency: row.frequency,
    startDate: row.start_date,
    startTime: row.start_time,
    timezone: row.timezone,
    sendingMode: row.sending_mode,
    spreadDays: row.spread_days,
    spreadUnit: row.spread_unit,
    businessHoursStart: row.business_hours_start,
    businessHoursEnd: row.business_hours_end,
    businessDays: JSON.parse(row.business_days || '[]'),
    trackActivityDays: row.track_activity_days,
    category: row.category,
    templateMode: row.template_mode,
    templateId: row.template_id,
    phishDomain: row.phish_domain,
    landingPageId: row.landing_page_id,
    addClickersToGroup: row.add_clickers_to_group,
    sendReportEmail: row.send_report_email,
    nextRunAt: row.next_run_at,
    lastRunAt: row.last_run_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================
// CREATE CAMPAIGN
// ============================================

export async function createCampaign(data: {
  name: string;
  description?: string;
  targetCount?: number;
  frequency?: string;
  startDate?: string;
  startTime?: string;
  timezone?: string;
  sendingMode?: string;
  spreadDays?: number;
  spreadUnit?: string;
  businessHoursStart?: string;
  businessHoursEnd?: string;
  businessDays?: string[];
  trackActivityDays?: number;
  category?: string;
  templateMode?: string;
  templateId?: string;
  phishDomain?: string;
  landingPageId?: string;
  addClickersToGroup?: string;
  sendReportEmail?: boolean;
}): Promise<Campaign> {
  const now = new Date();

  // Set defaults
  const campaignData = {
    name: data.name,
    description: data.description || '',
    targetCount: data.targetCount || 0,
    frequency: data.frequency || 'once',
    startDate: data.startDate,
    startTime: data.startTime,
    timezone: data.timezone || 'Europe/Istanbul',
    sendingMode: data.sendingMode || 'all',
    spreadDays: data.spreadDays || 3,
    spreadUnit: data.spreadUnit || 'days',
    businessHoursStart: data.businessHoursStart || '09:00',
    businessHoursEnd: data.businessHoursEnd || '17:00',
    businessDays: data.businessDays || ['mon', 'tue', 'wed', 'thu', 'fri'],
    trackActivityDays: data.trackActivityDays || 7,
    category: data.category || 'it',
    templateMode: data.templateMode || 'random',
    templateId: data.templateId,
    phishDomain: data.phishDomain || 'random',
    landingPageId: data.landingPageId,
    addClickersToGroup: data.addClickersToGroup,
    sendReportEmail: data.sendReportEmail !== undefined ? data.sendReportEmail : true,
  };

  if (config.useMemoryDb) {
    const campaign: Campaign = {
      id: generateId(),
      name: campaignData.name,
      description: campaignData.description,
      targetCount: campaignData.targetCount,
      frequency: campaignData.frequency as any,
      startDate: campaignData.startDate,
      startTime: campaignData.startTime,
      timezone: campaignData.timezone,
      sendingMode: campaignData.sendingMode as any,
      spreadDays: campaignData.spreadDays,
      spreadUnit: campaignData.spreadUnit as any,
      businessHoursStart: campaignData.businessHoursStart,
      businessHoursEnd: campaignData.businessHoursEnd,
      businessDays: campaignData.businessDays,
      trackActivityDays: campaignData.trackActivityDays,
      category: campaignData.category,
      templateMode: campaignData.templateMode as any,
      templateId: campaignData.templateId,
      phishDomain: campaignData.phishDomain,
      landingPageId: campaignData.landingPageId,
      addClickersToGroup: campaignData.addClickersToGroup,
      sendReportEmail: campaignData.sendReportEmail,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
    memoryStore.campaigns.push(campaign);
    console.log(`Campaign created: ${campaign.name}`);
    return campaign;
  }

  const p = await getPool();
  if (!p) throw new Error('Database not available');

  const result = await p.query(
    `INSERT INTO campaigns (
      name, description, target_count, frequency, start_date, start_time, timezone,
      sending_mode, spread_days, spread_unit, business_hours_start, business_hours_end,
      business_days, track_activity_days, category, template_mode, template_id,
      phish_domain, landing_page_id, add_clickers_to_group, send_report_email
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
    RETURNING *`,
    [
      campaignData.name,
      campaignData.description,
      campaignData.targetCount,
      campaignData.frequency,
      campaignData.startDate,
      campaignData.startTime,
      campaignData.timezone,
      campaignData.sendingMode,
      campaignData.spreadDays,
      campaignData.spreadUnit,
      campaignData.businessHoursStart,
      campaignData.businessHoursEnd,
      JSON.stringify(campaignData.businessDays),
      campaignData.trackActivityDays,
      campaignData.category,
      campaignData.templateMode,
      campaignData.templateId || null,
      campaignData.phishDomain,
      campaignData.landingPageId || null,
      campaignData.addClickersToGroup || null,
      campaignData.sendReportEmail,
    ]
  );

  const row = result.rows[0];
  console.log(`Campaign created: ${row.name}`);

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    targetCount: row.target_count,
    frequency: row.frequency,
    startDate: row.start_date,
    startTime: row.start_time,
    timezone: row.timezone,
    sendingMode: row.sending_mode,
    spreadDays: row.spread_days,
    spreadUnit: row.spread_unit,
    businessHoursStart: row.business_hours_start,
    businessHoursEnd: row.business_hours_end,
    businessDays: JSON.parse(row.business_days || '[]'),
    trackActivityDays: row.track_activity_days,
    category: row.category,
    templateMode: row.template_mode,
    templateId: row.template_id,
    phishDomain: row.phish_domain,
    landingPageId: row.landing_page_id,
    addClickersToGroup: row.add_clickers_to_group,
    sendReportEmail: row.send_report_email,
    nextRunAt: row.next_run_at,
    lastRunAt: row.last_run_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================
// UPDATE CAMPAIGN
// ============================================

export async function updateCampaign(
  id: string,
  data: { name?: string; description?: string; targetCount?: number }
): Promise<Campaign | null> {
  if (config.useMemoryDb) {
    const campaign = memoryStore.campaigns.find((c) => c.id === id);
    if (!campaign) return null;
    if (campaign.status !== 'draft') return null;

    if (data.name !== undefined) campaign.name = data.name;
    if (data.description !== undefined) campaign.description = data.description;
    if (data.targetCount !== undefined) campaign.targetCount = data.targetCount;
    campaign.updatedAt = new Date();
    console.log(`Campaign updated: ${campaign.name}`);
    return campaign;
  }

  const p = await getPool();
  if (!p) return null;

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  if (data.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(data.description);
  }
  if (data.targetCount !== undefined) {
    updates.push(`target_count = $${paramIndex++}`);
    values.push(data.targetCount);
  }

  if (updates.length === 0) return getCampaign(id);

  updates.push(`updated_at = NOW()`);
  values.push(id);

  const result = await p.query(
    `UPDATE campaigns SET ${updates.join(', ')}
     WHERE id = $${paramIndex} AND status = 'draft'
     RETURNING *`,
    values
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  console.log(`Campaign updated: ${row.name}`);

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    targetCount: row.target_count,
    frequency: row.frequency,
    startDate: row.start_date,
    startTime: row.start_time,
    timezone: row.timezone,
    sendingMode: row.sending_mode,
    spreadDays: row.spread_days,
    spreadUnit: row.spread_unit,
    businessHoursStart: row.business_hours_start,
    businessHoursEnd: row.business_hours_end,
    businessDays: JSON.parse(row.business_days || '[]'),
    trackActivityDays: row.track_activity_days,
    category: row.category,
    templateMode: row.template_mode,
    templateId: row.template_id,
    phishDomain: row.phish_domain,
    landingPageId: row.landing_page_id,
    addClickersToGroup: row.add_clickers_to_group,
    sendReportEmail: row.send_report_email,
    nextRunAt: row.next_run_at,
    lastRunAt: row.last_run_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================
// DELETE CAMPAIGN
// ============================================

export async function deleteCampaign(id: string): Promise<boolean> {
  if (config.useMemoryDb) {
    const index = memoryStore.campaigns.findIndex((c) => c.id === id);
    if (index === -1) return false;

    memoryStore.events = memoryStore.events.filter((e) => e.campaignId !== id);
    memoryStore.recipients = memoryStore.recipients.filter((r) => r.campaignId !== id);
    memoryStore.campaigns.splice(index, 1);
    console.log(`Campaign deleted: ${id}`);
    return true;
  }

  const p = await getPool();
  if (!p) return false;

  await p.query('DELETE FROM events WHERE campaign_id = $1', [id]);
  await p.query('DELETE FROM recipients WHERE campaign_id = $1', [id]);

  const result = await p.query('DELETE FROM campaigns WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) return false;

  console.log(`Campaign deleted: ${id}`);
  return true;
}

// ============================================
// START CAMPAIGN
// ============================================

export async function startCampaign(id: string): Promise<Campaign | null> {
  let campaign: Campaign | null = null;

  // --- Set status to active ---
  if (config.useMemoryDb) {
    const found = memoryStore.campaigns.find((c) => c.id === id);
    if (found && found.status === 'draft') {
      found.status = 'active';
      found.updatedAt = new Date();
      campaign = found;
    }
  } else {
    const p = await getPool();
    if (!p) return null;

    const result = await p.query(
      `UPDATE campaigns SET status = 'active', updated_at = NOW()
       WHERE id = $1 AND status = 'draft'
       RETURNING *`,
      [id]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];
      campaign = {
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        targetCount: row.target_count,
        frequency: row.frequency,
        startDate: row.start_date,
        startTime: row.start_time,
        timezone: row.timezone,
        sendingMode: row.sending_mode,
        spreadDays: row.spread_days,
        spreadUnit: row.spread_unit,
        businessHoursStart: row.business_hours_start,
        businessHoursEnd: row.business_hours_end,
        businessDays: JSON.parse(row.business_days || '[]'),
        trackActivityDays: row.track_activity_days,
        category: row.category,
        templateMode: row.template_mode,
        templateId: row.template_id,
        phishDomain: row.phish_domain,
        landingPageId: row.landing_page_id,
        addClickersToGroup: row.add_clickers_to_group,
        sendReportEmail: row.send_report_email,
        nextRunAt: row.next_run_at,
        lastRunAt: row.last_run_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }
  }

  if (!campaign) return null;

  console.log(`Campaign started: ${campaign.name}`);

  // --- Resolve email template ---
  let templateSubject = 'Acil: Şifrenizi Güncellemeniz Gerekmektedir';
  let templateBody = '<p>Sayın {{firstName}},</p><p>Lütfen <a href="{{trackingLink}}">buraya tıklayın</a>.</p>';

  if (campaign.templateMode === 'specific' && campaign.templateId) {
    const tpl = await getEmailTemplate(campaign.templateId);
    if (tpl) {
      templateSubject = tpl.subject;
      templateBody = tpl.body;
    }
  } else {
    // Random mode — pick a random template from the DB
    const allTemplates = await getEmailTemplates();
    if (allTemplates.length > 0) {
      const picked = allTemplates[Math.floor(Math.random() * allTemplates.length)];
      templateSubject = picked.subject;
      templateBody = picked.body;
    }
  }

  // --- Build tracking URL base ---
  // Tracking URLs point to the backend's /t/:token endpoint via the configured base URL.
  // In Docker: nginx on port 80 proxies /t/ to the backend.
  const trackingBase = config.trackingBaseUrl.replace(/\/+$/, '');

  // --- Dispatch emails to all recipients ---
  const recipients = await getRecipientsByCampaign(id);
  const phishDomain = campaign.phishDomain || 'secure-login.com';
  const useQueue = await isRedisAvailable();

  if (useQueue) {
    // --- Queue mode: enqueue all jobs in a single batch ---
    const jobs: EmailJobData[] = recipients.map((recipient) => {
      const trackingLink = `${trackingBase}/t/${recipient.token}`;
      return {
        recipientToken: recipient.token,
        recipientEmail: recipient.email,
        subject: replacePlaceholders(templateSubject, recipient, trackingLink, phishDomain),
        html: injectTrackingPixel(
          replacePlaceholders(templateBody, recipient, trackingLink, phishDomain),
          trackingBase, recipient.token
        ),
        campaignId: campaign.id,
        campaignName: campaign.name,
      };
    });

    await enqueueEmailBatch(jobs);
    console.log(`Campaign "${campaign.name}": ${jobs.length} emails enqueued`);
  } else {
    // --- Direct mode: Redis unavailable, non-blocking fallback ---
    console.warn(
      `[Campaign] ⚠ Redis is DOWN — sending ${recipients.length} emails in direct mode. ` +
      `This is a fallback; ensure Redis is running for production use.`
    );

    const campaignName = campaign.name;
    const totalRecipients = recipients.length;

    // Fire-and-forget: send in background so the HTTP response returns immediately.
    // Use p-limit to cap concurrency at 3 parallel sends, and yield between
    // batches so the event loop stays free for health checks / API requests.
    const CONCURRENCY = 3;
    const limit = pLimit(CONCURRENCY);

    setImmediate(async () => {
      let sentCount = 0;

      const tasks = recipients.map((recipient) =>
        limit(async () => {
          try {
            const trackingLink = `${trackingBase}/t/${recipient.token}`;
            const html = injectTrackingPixel(
              replacePlaceholders(templateBody, recipient, trackingLink, phishDomain),
              trackingBase, recipient.token
            );
            const subject = replacePlaceholders(templateSubject, recipient, trackingLink, phishDomain);

            const success = await sendEmail({ to: recipient.email, subject, html });
            if (success) {
              await updateRecipientStatus(recipient.token, 'sent');
              sentCount++;
            }
          } catch (error) {
            console.error(`Failed to send email to ${recipient.email}:`, error);
          }
          // Anti-spam jitter: random delay 2-5 seconds between sends
          const jitter = 2000 + Math.random() * 3000;
          await new Promise<void>((resolve) => setTimeout(resolve, jitter));
        })
      );

      await Promise.allSettled(tasks);
      console.log(`Campaign "${campaignName}": ${sentCount}/${totalRecipients} emails sent (direct mode)`);
    });

    console.log(`Campaign "${campaign.name}": ${recipients.length} emails dispatched in background (direct mode)`);
  }

  return campaign;
}

// ============================================
// PAUSE CAMPAIGN
// ============================================

export async function pauseCampaign(id: string): Promise<Campaign | null> {
  if (config.useMemoryDb) {
    const campaign = memoryStore.campaigns.find((c) => c.id === id);
    if (campaign && campaign.status === 'active') {
      campaign.status = 'paused';
      campaign.updatedAt = new Date();
      console.log(`Campaign paused: ${campaign.name}`);
      return campaign;
    }
    return null;
  }

  const p = await getPool();
  if (!p) return null;

  const result = await p.query(
    `UPDATE campaigns SET status = 'paused', updated_at = NOW()
     WHERE id = $1 AND status = 'active'
     RETURNING *`,
    [id]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  console.log(`Campaign paused: ${row.name}`);

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    targetCount: row.target_count,
    frequency: row.frequency,
    startDate: row.start_date,
    startTime: row.start_time,
    timezone: row.timezone,
    sendingMode: row.sending_mode,
    spreadDays: row.spread_days,
    spreadUnit: row.spread_unit,
    businessHoursStart: row.business_hours_start,
    businessHoursEnd: row.business_hours_end,
    businessDays: JSON.parse(row.business_days || '[]'),
    trackActivityDays: row.track_activity_days,
    category: row.category,
    templateMode: row.template_mode,
    templateId: row.template_id,
    phishDomain: row.phish_domain,
    landingPageId: row.landing_page_id,
    addClickersToGroup: row.add_clickers_to_group,
    sendReportEmail: row.send_report_email,
    nextRunAt: row.next_run_at,
    lastRunAt: row.last_run_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================
// RESUME CAMPAIGN
// ============================================

export async function resumeCampaign(id: string): Promise<Campaign | null> {
  if (config.useMemoryDb) {
    const campaign = memoryStore.campaigns.find((c) => c.id === id);
    if (campaign && campaign.status === 'paused') {
      campaign.status = 'active';
      campaign.updatedAt = new Date();
      console.log(`Campaign resumed: ${campaign.name}`);
      return campaign;
    }
    return null;
  }

  const p = await getPool();
  if (!p) return null;

  const result = await p.query(
    `UPDATE campaigns SET status = 'active', updated_at = NOW()
     WHERE id = $1 AND status = 'paused'
     RETURNING *`,
    [id]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  console.log(`Campaign resumed: ${row.name}`);

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    targetCount: row.target_count,
    frequency: row.frequency,
    startDate: row.start_date,
    startTime: row.start_time,
    timezone: row.timezone,
    sendingMode: row.sending_mode,
    spreadDays: row.spread_days,
    spreadUnit: row.spread_unit,
    businessHoursStart: row.business_hours_start,
    businessHoursEnd: row.business_hours_end,
    businessDays: JSON.parse(row.business_days || '[]'),
    trackActivityDays: row.track_activity_days,
    category: row.category,
    templateMode: row.template_mode,
    templateId: row.template_id,
    phishDomain: row.phish_domain,
    landingPageId: row.landing_page_id,
    addClickersToGroup: row.add_clickers_to_group,
    sendReportEmail: row.send_report_email,
    nextRunAt: row.next_run_at,
    lastRunAt: row.last_run_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================
// COMPLETE CAMPAIGN
// ============================================

export async function completeCampaign(id: string): Promise<Campaign | null> {
  if (config.useMemoryDb) {
    const campaign = memoryStore.campaigns.find((c) => c.id === id);
    if (campaign && (campaign.status === 'active' || campaign.status === 'paused')) {
      campaign.status = 'completed';
      campaign.updatedAt = new Date();
      console.log(`Campaign completed: ${campaign.name}`);
      return campaign;
    }
    return null;
  }

  const p = await getPool();
  if (!p) return null;

  const result = await p.query(
    `UPDATE campaigns SET status = 'completed', updated_at = NOW()
     WHERE id = $1 AND status IN ('active', 'paused')
     RETURNING *`,
    [id]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  console.log(`Campaign completed: ${row.name}`);

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    targetCount: row.target_count,
    frequency: row.frequency,
    startDate: row.start_date,
    startTime: row.start_time,
    timezone: row.timezone,
    sendingMode: row.sending_mode,
    spreadDays: row.spread_days,
    spreadUnit: row.spread_unit,
    businessHoursStart: row.business_hours_start,
    businessHoursEnd: row.business_hours_end,
    businessDays: JSON.parse(row.business_days || '[]'),
    trackActivityDays: row.track_activity_days,
    category: row.category,
    templateMode: row.template_mode,
    templateId: row.template_id,
    phishDomain: row.phish_domain,
    landingPageId: row.landing_page_id,
    addClickersToGroup: row.add_clickers_to_group,
    sendReportEmail: row.send_report_email,
    nextRunAt: row.next_run_at,
    lastRunAt: row.last_run_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================
// GET CAMPAIGN STATS
// ============================================

export async function getCampaignStats(campaignId: string): Promise<CampaignStats> {
  if (config.useMemoryDb) {
    const recipients = memoryStore.recipients.filter((r) => r.campaignId === campaignId);
    const totalTargets = recipients.length;
    const emailsSent = recipients.filter((r) => r.status !== 'pending').length;

    const events = memoryStore.events.filter((e) => e.campaignId === campaignId);
    const openedTokens = new Set(events.filter((e) => e.type === 'opened').map((e) => e.recipientToken));
    const clickedTokens = new Set(events.filter((e) => e.type === 'clicked').map((e) => e.recipientToken));
    const submittedTokens = new Set(events.filter((e) => e.type === 'submitted').map((e) => e.recipientToken));

    const opened = openedTokens.size;
    const clicked = clickedTokens.size;
    const submitted = submittedTokens.size;

    return {
      totalTargets,
      emailsSent,
      opened,
      clicked,
      submitted,
      openRate: totalTargets > 0 ? (opened / totalTargets) * 100 : 0,
      clickRate: totalTargets > 0 ? (clicked / totalTargets) * 100 : 0,
      submitRate: totalTargets > 0 ? (submitted / totalTargets) * 100 : 0,
    };
  }

  const p = await getPool();
  if (!p) {
    return { totalTargets: 0, emailsSent: 0, opened: 0, clicked: 0, submitted: 0, openRate: 0, clickRate: 0, submitRate: 0 };
  }

  const recipientResult = await p.query(
    `SELECT COUNT(*) as total,
            COUNT(CASE WHEN status != 'pending' THEN 1 END) as sent
     FROM recipients WHERE campaign_id = $1`,
    [campaignId]
  );

  const totalTargets = parseInt(recipientResult.rows[0].total, 10);
  const emailsSent = parseInt(recipientResult.rows[0].sent, 10);

  const openedResult = await p.query(
    `SELECT COUNT(DISTINCT recipient_token) as count FROM events
     WHERE campaign_id = $1 AND type = 'opened'`,
    [campaignId]
  );

  const clickedResult = await p.query(
    `SELECT COUNT(DISTINCT recipient_token) as count FROM events
     WHERE campaign_id = $1 AND type = 'clicked'`,
    [campaignId]
  );

  const submittedResult = await p.query(
    `SELECT COUNT(DISTINCT recipient_token) as count FROM events
     WHERE campaign_id = $1 AND type = 'submitted'`,
    [campaignId]
  );

  const opened = parseInt(openedResult.rows[0].count, 10);
  const clicked = parseInt(clickedResult.rows[0].count, 10);
  const submitted = parseInt(submittedResult.rows[0].count, 10);

  return {
    totalTargets,
    emailsSent,
    opened,
    clicked,
    submitted,
    openRate: totalTargets > 0 ? (opened / totalTargets) * 100 : 0,
    clickRate: totalTargets > 0 ? (clicked / totalTargets) * 100 : 0,
    submitRate: totalTargets > 0 ? (submitted / totalTargets) * 100 : 0,
  };
}
