import { Router, Request, Response } from 'express';
import {
  getCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  startCampaign,
  pauseCampaign,
  resumeCampaign,
  completeCampaign,
  getCampaignStats,
  getEventsByCampaign,
} from '../services/index.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/asyncHandler.js';

const router = Router();

// ============================================
// VALIDATION
// ============================================

interface CreateCampaignBody {
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
  attachmentId?: string;
  addClickersToGroup?: string;
  sendReportEmail?: boolean;
}

function isValidCreateCampaign(body: unknown): body is CreateCampaignBody {
  if (typeof body !== 'object' || body === null) return false;
  const obj = body as Record<string, unknown>;
  return (
    typeof obj.name === 'string' &&
    obj.name.trim().length > 0 &&
    obj.name.length <= 255
  );
}

interface UpdateCampaignBody {
  name?: string;
  description?: string;
  targetCount?: number;
}

// ============================================
// ROUTES
// ============================================

router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const campaigns = await getCampaigns();
  sendSuccess(res, campaigns);
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const campaign = await getCampaign(req.params.id);
  if (!campaign) { sendError(res, 404, 'Campaign not found'); return; }

  const [stats, events] = await Promise.all([
    getCampaignStats(campaign.id),
    getEventsByCampaign(campaign.id),
  ]);

  sendSuccess(res, { ...campaign, stats, events });
}));

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  if (!isValidCreateCampaign(req.body)) { sendError(res, 400, 'Invalid request body'); return; }

  const b = req.body;
  const campaign = await createCampaign({
    name: b.name.trim(),
    description: (b.description || '').trim(),
    targetCount: b.targetCount || 0,
    frequency: b.frequency,
    startDate: b.startDate,
    startTime: b.startTime,
    timezone: b.timezone,
    sendingMode: b.sendingMode,
    spreadDays: b.spreadDays,
    spreadUnit: b.spreadUnit,
    businessHoursStart: b.businessHoursStart,
    businessHoursEnd: b.businessHoursEnd,
    businessDays: b.businessDays,
    trackActivityDays: b.trackActivityDays,
    category: b.category,
    templateMode: b.templateMode,
    templateId: b.templateId,
    phishDomain: b.phishDomain,
    landingPageId: b.landingPageId,
    attachmentId: b.attachmentId,
    addClickersToGroup: b.addClickersToGroup,
    sendReportEmail: b.sendReportEmail,
  });

  sendSuccess(res, campaign, 201);
}));

router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as UpdateCampaignBody;
  const campaign = await updateCampaign(req.params.id, {
    name: body.name?.trim(),
    description: body.description?.trim(),
    targetCount: body.targetCount,
  });
  if (!campaign) { sendError(res, 404, 'Campaign not found or not editable'); return; }
  sendSuccess(res, campaign);
}));

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const deleted = await deleteCampaign(req.params.id);
  if (!deleted) { sendError(res, 404, 'Campaign not found'); return; }
  sendSuccess(res, null);
}));

router.post('/:id/start', asyncHandler(async (req: Request, res: Response) => {
  const campaign = await startCampaign(req.params.id);
  if (!campaign) { sendError(res, 404, 'Campaign not found or already started'); return; }
  sendSuccess(res, campaign);
}));

router.post('/:id/pause', asyncHandler(async (req: Request, res: Response) => {
  const campaign = await pauseCampaign(req.params.id);
  if (!campaign) { sendError(res, 404, 'Campaign not found or not active'); return; }
  sendSuccess(res, campaign);
}));

router.post('/:id/resume', asyncHandler(async (req: Request, res: Response) => {
  const campaign = await resumeCampaign(req.params.id);
  if (!campaign) { sendError(res, 404, 'Campaign not found or not paused'); return; }
  sendSuccess(res, campaign);
}));

router.post('/:id/complete', asyncHandler(async (req: Request, res: Response) => {
  const campaign = await completeCampaign(req.params.id);
  if (!campaign) { sendError(res, 404, 'Campaign not found or not completable'); return; }
  sendSuccess(res, campaign);
}));

export default router;
