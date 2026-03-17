import { config } from '../config.js';
import { getPool, memoryStore } from '../db/index.js';
import type { DashboardStats, DepartmentStat } from '../types/index.js';

// ============================================
// GET DASHBOARD STATS
// ============================================

export async function getDashboardStats(): Promise<DashboardStats> {
  if (config.useMemoryDb) {
    const campaigns = memoryStore.campaigns;
    const recipients = memoryStore.recipients;
    const events = memoryStore.events;

    const sentRecipients = recipients.filter((r) => r.status !== 'pending').length;
    const openedTokens = new Set(events.filter((e) => e.type === 'opened').map((e) => e.recipientToken));
    const clickedTokens = new Set(events.filter((e) => e.type === 'clicked').map((e) => e.recipientToken));
    const submittedTokens = new Set(events.filter((e) => e.type === 'submitted').map((e) => e.recipientToken));

    const totalRecipients = recipients.length;
    const totalEmailsSent = sentRecipients;
    const totalOpened = openedTokens.size;
    const totalClicks = clickedTokens.size;
    const totalSubmissions = submittedTokens.size;
    const fileDownloadTokens = new Set(events.filter((e) => e.type === 'file_downloaded').map((e) => e.recipientToken));
    const totalFileDownloads = fileDownloadTokens.size;

    return {
      totalCampaigns: campaigns.length,
      activeCampaigns: campaigns.filter((c) => c.status === 'active').length,
      completedCampaigns: campaigns.filter((c) => c.status === 'completed').length,
      draftCampaigns: campaigns.filter((c) => c.status === 'draft').length,
      pausedCampaigns: campaigns.filter((c) => c.status === 'paused').length,
      totalRecipients,
      totalEmailsSent,
      totalOpened,
      totalClicks,
      totalSubmissions,
      overallOpenRate: totalEmailsSent > 0 ? (totalOpened / totalEmailsSent) * 100 : 0,
      overallClickRate: totalEmailsSent > 0 ? (totalClicks / totalEmailsSent) * 100 : 0,
      overallSubmitRate: totalEmailsSent > 0 ? (totalSubmissions / totalEmailsSent) * 100 : 0,
      totalFileDownloads,
      overallFileDownloadRate: totalEmailsSent > 0 ? (totalFileDownloads / totalEmailsSent) * 100 : 0,
    };
  }

  const p = await getPool();
  if (!p) {
    return {
      totalCampaigns: 0,
      activeCampaigns: 0,
      completedCampaigns: 0,
      draftCampaigns: 0,
      pausedCampaigns: 0,
      totalRecipients: 0,
      totalEmailsSent: 0,
      totalOpened: 0,
      totalClicks: 0,
      totalSubmissions: 0,
      overallOpenRate: 0,
      overallClickRate: 0,
      overallSubmitRate: 0,
      totalFileDownloads: 0,
      overallFileDownloadRate: 0,
    };
  }

  const [campaignStats, recipientStats, openStats, clickStats, submitStats, fileDownloadStats] = await Promise.all([
    p.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
        SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) as paused
      FROM campaigns
    `),
    p.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status != 'pending' THEN 1 ELSE 0 END) as sent
      FROM recipients
    `),
    p.query(`SELECT COUNT(DISTINCT recipient_token) as count FROM events WHERE type = 'opened'`),
    p.query(`SELECT COUNT(DISTINCT recipient_token) as count FROM events WHERE type = 'clicked'`),
    p.query(`SELECT COUNT(DISTINCT recipient_token) as count FROM events WHERE type = 'submitted'`),
    p.query(`SELECT COUNT(DISTINCT recipient_token) as count FROM events WHERE type = 'file_downloaded'`),
  ]);

  const c = campaignStats.rows[0];
  const r = recipientStats.rows[0];
  const totalEmailsSent = parseInt(r.sent || '0', 10);
  const totalOpened = parseInt(openStats.rows[0].count, 10);
  const totalClicks = parseInt(clickStats.rows[0].count, 10);
  const totalSubmissions = parseInt(submitStats.rows[0].count, 10);
  const totalFileDownloads = parseInt(fileDownloadStats.rows[0].count, 10);

  return {
    totalCampaigns: parseInt(c.total, 10),
    activeCampaigns: parseInt(c.active || '0', 10),
    completedCampaigns: parseInt(c.completed || '0', 10),
    draftCampaigns: parseInt(c.draft || '0', 10),
    pausedCampaigns: parseInt(c.paused || '0', 10),
    totalRecipients: parseInt(r.total, 10),
    totalEmailsSent,
    totalOpened,
    totalClicks,
    totalSubmissions,
    overallOpenRate: totalEmailsSent > 0 ? (totalOpened / totalEmailsSent) * 100 : 0,
    overallClickRate: totalEmailsSent > 0 ? (totalClicks / totalEmailsSent) * 100 : 0,
    overallSubmitRate: totalEmailsSent > 0 ? (totalSubmissions / totalEmailsSent) * 100 : 0,
    totalFileDownloads,
    overallFileDownloadRate: totalEmailsSent > 0 ? (totalFileDownloads / totalEmailsSent) * 100 : 0,
  };
}

// ============================================
// GET DEPARTMENT STATS (Vulnerability by Faculty)
// ============================================
// Formula: Submission Rate = (Total Submitted / Total Clicked) × 100

export async function getDepartmentStats(): Promise<DepartmentStat[]> {
  if (config.useMemoryDb) {
    const recipients = memoryStore.recipients;
    const events = memoryStore.events;

    const clickedTokens = new Set(events.filter(e => e.type === 'clicked').map(e => e.recipientToken));
    const submittedTokens = new Set(events.filter(e => e.type === 'submitted').map(e => e.recipientToken));

    const facultyMap = new Map<string, { total: number; clicked: number; submitted: number }>();

    for (const r of recipients) {
      const fac = r.faculty || 'Ozel Gonderim';
      if (!facultyMap.has(fac)) facultyMap.set(fac, { total: 0, clicked: 0, submitted: 0 });
      const entry = facultyMap.get(fac)!;
      entry.total++;
      if (clickedTokens.has(r.token)) entry.clicked++;
      if (submittedTokens.has(r.token)) entry.submitted++;
    }

    return Array.from(facultyMap.entries()).map(([faculty, data]) => ({
      faculty,
      totalRecipients: data.total,
      totalClicked: data.clicked,
      totalSubmitted: data.submitted,
      submissionRate: data.clicked > 0 ? (data.submitted / data.clicked) * 100 : 0,
    }));
  }

  const p = await getPool();
  if (!p) return [];

  const result = await p.query(`
    SELECT
      COALESCE(NULLIF(r.faculty, ''), 'Ozel Gonderim') AS faculty,
      COUNT(DISTINCT r.id) AS total_recipients,
      COUNT(DISTINCT CASE WHEN e_click.recipient_token IS NOT NULL THEN r.token END) AS total_clicked,
      COUNT(DISTINCT CASE WHEN e_submit.recipient_token IS NOT NULL THEN r.token END) AS total_submitted
    FROM recipients r
    LEFT JOIN events e_click ON e_click.recipient_token = r.token AND e_click.type = 'clicked'
    LEFT JOIN events e_submit ON e_submit.recipient_token = r.token AND e_submit.type = 'submitted'
    GROUP BY COALESCE(NULLIF(r.faculty, ''), 'Ozel Gonderim')
    ORDER BY total_recipients DESC
  `);

  return result.rows.map((row: { faculty: string; total_recipients: string; total_clicked: string; total_submitted: string }) => {
    const clicked = parseInt(row.total_clicked, 10);
    const submitted = parseInt(row.total_submitted, 10);
    return {
      faculty: row.faculty,
      totalRecipients: parseInt(row.total_recipients, 10),
      totalClicked: clicked,
      totalSubmitted: submitted,
      submissionRate: clicked > 0 ? (submitted / clicked) * 100 : 0,
    };
  });
}
