import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '8080', 10),
  corsOrigin: process.env.CORS_ORIGIN?.split(',').map(s => s.trim()) || [],
  isProduction: process.env.NODE_ENV === 'production',
  databaseUrl: process.env.DATABASE_URL,
  useMemoryDb: process.env.USE_MEMORY_DB === 'true' || !process.env.DATABASE_URL,

  // SMTP Configuration (MailHog default for dev, university SMTP for prod)
  smtp: {
    host: process.env.SMTP_HOST || 'mailhog',
    port: parseInt(process.env.SMTP_PORT || '1025', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    fromAddress: process.env.SMTP_FROM || 'noreply@university.edu.tr',
    fromName: process.env.SMTP_FROM_NAME || 'IT Departmanı',
  },

  // Redis Configuration (for BullMQ job queue)
  redis: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    tls: process.env.REDIS_TLS === 'true',
  },

  // Queue Configuration (BullMQ worker tuning)
  queue: {
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '3', 10),
    rateMax: parseInt(process.env.QUEUE_RATE_MAX || '5', 10),
    rateDuration: parseInt(process.env.QUEUE_RATE_DURATION || '1000', 10),
  },

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  // Tracking URL base (where phishing links point to)
  trackingBaseUrl: process.env.TRACKING_BASE_URL || 'http://localhost',

  // Final redirect URL after phishing form submission (maintains illusion)
  finalRedirectUrl: process.env.FINAL_REDIRECT_URL || 'https://www.estu.edu.tr',

  // LDAP Configuration
  ldap: {
    url: process.env.LDAP_URL || 'ldap://localhost:389',
    adminDn: process.env.LDAP_ADMIN_DN || 'cn=admin,dc=university,dc=edu,dc=tr',
    adminPassword: process.env.LDAP_ADMIN_PASSWORD || 'admin',
    baseDn: process.env.LDAP_BASE_DN || 'dc=university,dc=edu,dc=tr',
    userFilter: process.env.LDAP_USER_FILTER || '(objectClass=inetOrgPerson)',
    usersOu: process.env.LDAP_USERS_OU || 'ou=users',

    // Attribute mapping — maps generic fields to LDAP-specific attribute names.
    // Change these when the target LDAP/AD uses different attributes.
    //
    // Examples:
    //   Standard OpenLDAP:  mail, givenName, sn, uid
    //   Active Directory:   mail, givenName, sn, sAMAccountName
    //   Custom schemas:     email, firstName, lastName, username
    mapping: {
      email:      process.env.LDAP_ATTR_EMAIL      || 'mail',
      firstName:  process.env.LDAP_ATTR_FIRSTNAME  || 'givenName',
      lastName:   process.env.LDAP_ATTR_LASTNAME   || 'sn',
      username:   process.env.LDAP_ATTR_USERNAME   || 'uid',
      fullName:   process.env.LDAP_ATTR_FULLNAME   || 'cn',
      department: process.env.LDAP_ATTR_DEPARTMENT || 'departmentNumber',
      title:      process.env.LDAP_ATTR_TITLE      || 'title',
    },
  },
};
