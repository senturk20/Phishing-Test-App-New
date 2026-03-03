// Campaign Service
export {
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
} from './campaignService.js';

// Event Service
export { getEventsByCampaign, insertEvent } from './eventService.js';

// Recipient Service
export {
  getRecipientsByCampaign,
  createRecipient,
  createRecipientsBulk,
  updateRecipientStatus,
  deleteRecipient,
  getRecipientByToken,
} from './recipientService.js';

// Template Service
export {
  getEmailTemplates,
  getEmailTemplate,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
} from './templateService.js';

// Landing Page Service
export {
  getLandingPages,
  getLandingPage,
  createLandingPage,
  updateLandingPage,
  deleteLandingPage,
} from './landingPageService.js';

// Dashboard Service
export { getDashboardStats } from './dashboardService.js';

// Mail Service
export { sendEmail } from './mailService.js';
export type { SendEmailParams } from './mailService.js';

// LDAP Service
export {
  testLdapConnection,
  searchLdapUsers,
  syncLdapUsersToCampaign,
  getLdapUsersPreview,
  closeLdapConnection,
} from './ldapService.js';
export type { LdapUser, SyncResult } from './ldapService.js';
