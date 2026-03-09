import type {
  Campaign,
  CampaignEvent,
  Recipient,
  EmailTemplate,
  LandingPage,
  Admin,
} from '../types/index.js';

export const memoryStore = {
  campaigns: [] as Campaign[],
  events: [] as CampaignEvent[],
  recipients: [] as Recipient[],
  emailTemplates: [] as EmailTemplate[],
  landingPages: [] as LandingPage[],
  admins: [] as Admin[],
  nextId: 1,
};

export function generateId(): string {
  return `${Date.now()}-${memoryStore.nextId++}`;
}

export function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
