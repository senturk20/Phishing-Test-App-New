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
  getAllRecipients,
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

// Queue Service
export {
  isRedisAvailable,
  enqueueEmailBatch,
  enqueueEmailWithDelay,
  getQueueStats,
  closeQueue,
} from './queueService.js';
export type { EmailJobData } from './queueService.js';

// Scheduler Service
export {
  calculateNextSendTime,
  calculateSendDelays,
  startCompletionChecker,
  stopCompletionChecker,
} from './schedulerService.js';

// Mail Worker
export { startMailWorker, stopMailWorker } from './mailWorker.js';

// Admin Service
export {
  getAdminByUsername,
  getAdminById,
  createAdmin,
  verifyPassword,
  seedDefaultAdminIfNeeded,
} from './adminService.js';

// Cloner Service
export { mirrorSite, deleteCloneFolder } from './clonerService.js';
export type { MirrorResult } from './clonerService.js';

// LDAP Service
export {
  testLdapConnection,
  ldapHealthCheck,
  searchLdapUsers,
  searchLdapUsersByFaculty,
  syncLdapUsersToCampaign,
  syncLdapFacultyToCampaign,
  getLdapUsersPreview,
  closeLdapConnection,
} from './ldapService.js';
export type { LdapUser, SyncResult } from './ldapService.js';

// Dashboard Department Stats
export { getDepartmentStats } from './dashboardService.js';
export type { DepartmentStat } from '../types/index.js';

// Attachment Service
export {
  getAttachments,
  getAttachment,
  createAttachment,
  deleteAttachment,
} from './attachmentService.js';
