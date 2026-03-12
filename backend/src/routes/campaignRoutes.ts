import { Router, Request, Response, NextFunction } from 'express';
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
} from '../services/index.js';
import { getEventsByCampaign } from '../services/index.js';

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

// List all campaigns
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const campaigns = await getCampaigns();
    res.json(campaigns);
  } catch (err) {
    console.error('[getCampaigns] Failed to fetch campaigns:', err);
    next(err);
  }
});

// Get single campaign with stats and events
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await getCampaign(req.params.id);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    const [stats, events] = await Promise.all([
      getCampaignStats(campaign.id),
      getEventsByCampaign(campaign.id),
    ]);

    res.json({ ...campaign, stats, events });
  } catch (err) {
    next(err);
  }
});

// Create new campaign
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isValidCreateCampaign(req.body)) {
      res.status(400).json({ error: 'Invalid request body' });
      return;
    }

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
      addClickersToGroup: b.addClickersToGroup,
      sendReportEmail: b.sendReportEmail,
    });

    res.status(201).json(campaign);
  } catch (err) {
    next(err);
  }
});

// Update campaign
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as UpdateCampaignBody;
    const campaign = await updateCampaign(req.params.id, {
      name: body.name?.trim(),
      description: body.description?.trim(),
      targetCount: body.targetCount,
    });
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found or not editable' });
      return;
    }
    res.json(campaign);
  } catch (err) {
    next(err);
  }
});

// Delete campaign
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await deleteCampaign(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Start campaign
router.post('/:id/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await startCampaign(req.params.id);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found or already started' });
      return;
    }
    res.json(campaign);
  } catch (err) {
    next(err);
  }
});

// Pause campaign
router.post('/:id/pause', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await pauseCampaign(req.params.id);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found or not active' });
      return;
    }
    res.json(campaign);
  } catch (err) {
    next(err);
  }
});

// Resume campaign
router.post('/:id/resume', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await resumeCampaign(req.params.id);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found or not paused' });
      return;
    }
    res.json(campaign);
  } catch (err) {
    next(err);
  }
});

// Complete campaign
router.post('/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await completeCampaign(req.params.id);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found or not completable' });
      return;
    }
    res.json(campaign);
  } catch (err) {
    next(err);
  }
});

export default router;
