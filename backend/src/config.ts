import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '8080', 10),
  corsOrigin: process.env.CORS_ORIGIN?.split(',').map(s => s.trim()) || [],
  isProduction: process.env.NODE_ENV === 'production',
  databaseUrl: process.env.DATABASE_URL,
  useMemoryDb: process.env.USE_MEMORY_DB === 'true' || !process.env.DATABASE_URL,

  // SMTP Configuration (MailHog default)
  smtp: {
    host: process.env.SMTP_HOST || 'mailhog',
    port: parseInt(process.env.SMTP_PORT || '1025', 10),
    fromAddress: process.env.SMTP_FROM || 'noreply@university.edu.tr',
    fromName: process.env.SMTP_FROM_NAME || 'IT Departmanı',
  },

  // Tracking URL base (where phishing links point to)
  trackingBaseUrl: process.env.TRACKING_BASE_URL || 'http://localhost',

  // LDAP Configuration
  ldap: {
    url: process.env.LDAP_URL || 'ldap://localhost:389',
    adminDn: process.env.LDAP_ADMIN_DN || 'cn=admin,dc=university,dc=edu,dc=tr',
    adminPassword: process.env.LDAP_ADMIN_PASSWORD || 'admin',
    baseDn: process.env.LDAP_BASE_DN || 'dc=university,dc=edu,dc=tr',
    userFilter: process.env.LDAP_USER_FILTER || '(objectClass=inetOrgPerson)',
    usersOu: process.env.LDAP_USERS_OU || 'ou=users',
  },
};
