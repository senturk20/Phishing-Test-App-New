// ============================================
// CAMPAIGN TYPES
// ============================================

export type CampaignStatus = 'draft' | 'active' | 'completed' | 'paused';
export type Frequency = 'once' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
export type SendingMode = 'all' | 'spread';
export type SpreadUnit = 'hours' | 'days';
export type TemplateMode = 'random' | 'specific';

export interface Campaign {
  id: string;
  name: string;
  description: string;
  status: CampaignStatus;
  targetCount: number;

  // Scheduling
  frequency: Frequency;
  startDate?: string;
  startTime?: string;
  timezone: string;

  // Sending configuration
  sendingMode: SendingMode;
  spreadDays: number;
  spreadUnit: SpreadUnit;
  businessHoursStart: string;
  businessHoursEnd: string;
  businessDays: string[];
  trackActivityDays: number;

  // Email template configuration
  category: string;
  templateMode: TemplateMode;
  templateId?: string;

  // Phishing configuration
  phishDomain: string;
  landingPageId?: string;
  addClickersToGroup?: string;
  sendReportEmail: boolean;

  // Scheduling metadata
  nextRunAt?: Date;
  lastRunAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignStats {
  totalTargets: number;
  emailsSent: number;
  clicked: number;
  submitted: number;
  clickRate: number;
  submitRate: number;
}

export interface CampaignDetail extends Campaign {
  stats: CampaignStats;
  events: CampaignEvent[];
}

// ============================================
// EVENT TYPES
// ============================================

export type EventType = 'clicked' | 'submitted';

export interface CampaignEvent {
  id: string;
  type: string;
  campaignId: string;
  recipientToken: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

// ============================================
// RECIPIENT TYPES
// ============================================

export type RecipientStatus = 'pending' | 'sent' | 'clicked' | 'submitted' | 'failed';

export interface Recipient {
  id: string;
  campaignId: string;
  email: string;
  firstName: string;
  lastName: string;
  token: string;
  status: RecipientStatus;
  sentAt?: Date;
  clickedAt?: Date;
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// EMAIL TEMPLATE TYPES
// ============================================

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// LANDING PAGE TYPES
// ============================================

export interface LandingPage {
  id: string;
  name: string;
  slug: string;
  html: string;
  originalUrl: string;
  isCloned: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// ADMIN TYPES
// ============================================

export interface Admin {
  id: string;
  username: string;
  passwordHash: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// DASHBOARD TYPES
// ============================================

export interface DashboardStats {
  totalCampaigns: number;
  activeCampaigns: number;
  completedCampaigns: number;
  draftCampaigns: number;
  pausedCampaigns: number;
  totalRecipients: number;
  totalEmailsSent: number;
  totalClicks: number;
  totalSubmissions: number;
  overallClickRate: number;
  overallSubmitRate: number;
}
