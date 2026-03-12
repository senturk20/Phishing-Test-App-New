export type CampaignStatus = 'draft' | 'active' | 'completed' | 'paused';
export type EventType = 'opened' | 'clicked' | 'submitted';
export type RecipientStatus = 'pending' | 'sent' | 'clicked' | 'submitted' | 'failed';
export type Frequency = 'once' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
export type SendingMode = 'all' | 'spread';

export interface Campaign {
  id: string;
  name: string;
  description: string;
  status: CampaignStatus;
  targetCount: number;
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
  createdAt: string;
  updatedAt: string;
}

export interface CampaignEvent {
  id: string;
  type: EventType;
  campaignId: string;
  recipientToken: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface CampaignStats {
  totalTargets: number;
  emailsSent: number;
  opened: number;
  clicked: number;
  submitted: number;
  openRate: number;
  clickRate: number;
  submitRate: number;
}

export interface CampaignDetail extends Campaign {
  stats: CampaignStats;
  events: CampaignEvent[];
}

export interface Recipient {
  id: string;
  campaignId: string;
  email: string;
  firstName: string;
  lastName: string;
  department: string;
  faculty: string;
  role: string;
  token: string;
  status: RecipientStatus;
  sentAt?: string;
  clickedAt?: string;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserGroup {
  id: string;
  name: string;
  memberCount: number;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LandingPage {
  id: string;
  name: string;
  slug: string;
  html: string;
  originalUrl: string;
  isCloned: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalCampaigns: number;
  activeCampaigns: number;
  completedCampaigns: number;
  draftCampaigns: number;
  pausedCampaigns: number;
  totalRecipients: number;
  totalEmailsSent: number;
  totalOpened: number;
  totalClicks: number;
  totalSubmissions: number;
  overallOpenRate: number;
  overallClickRate: number;
  overallSubmitRate: number;
}

// LDAP Types — matches backend LdapUser serialization
export interface LdapUser {
  dn: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  fullName: string;
  department: string;
  title: string;
  faculty: string;
}

export interface LdapFaculty {
  name: string;
  count: number;
}

export interface DepartmentStat {
  faculty: string;
  totalRecipients: number;
  totalClicked: number;
  totalSubmitted: number;
  submissionRate: number;
}

export interface LdapSyncResult {
  success: boolean;
  totalFound: number;
  synced: number;
  skipped: number;
  errors: number;
  details: Array<{
    email: string;
    status: 'synced' | 'skipped' | 'error';
    message?: string;
  }>;
}

export interface CampaignFormData {
  name: string;
  description?: string;
  targetCount?: number;
  targetGroupId: string;
  frequency: Frequency;
  startDate: string;
  startTime: string;
  timezone: string;
  sendingMode: SendingMode;
  spreadDays: number;
  spreadUnit: 'hours' | 'days';
  businessHoursStart: string;
  businessHoursEnd: string;
  businessDays: string[];
  trackActivityDays: number;
  category: string;
  templateMode: 'random' | 'specific';
  templateId?: string;
  phishDomain: string;
  landingPageId?: string;
  addClickersToGroup?: string;
  sendReportEmail: boolean;
}
