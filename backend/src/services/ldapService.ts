import ldap from 'ldapjs';
import { config } from '../config.js';
import { getPool, memoryStore, generateId, generateToken } from '../db/index.js';
import type { Recipient } from '../types/index.js';

// ============================================
// LDAP CLIENT
// ============================================

let ldapClient: ldap.Client | null = null;

function getClient(): ldap.Client {
  if (!ldapClient) {
    ldapClient = ldap.createClient({
      url: config.ldap.url,
      reconnect: true,
    });

    ldapClient.on('error', (err) => {
      console.error('[LDAP] Connection error:', err.message);
      ldapClient = null;
    });
  }
  return ldapClient;
}

export function closeLdapConnection(): void {
  if (ldapClient) {
    ldapClient.unbind(() => {
      console.log('[LDAP] Connection closed');
    });
    ldapClient = null;
  }
}

// ============================================
// LDAP BIND (Authentication)
// ============================================

async function bindAdmin(): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = getClient();
    client.bind(config.ldap.adminDn, config.ldap.adminPassword, (err) => {
      if (err) {
        console.error('[LDAP] Bind failed:', err.message);
        reject(new Error(`LDAP bind failed: ${err.message}`));
      } else {
        resolve();
      }
    });
  });
}

// ============================================
// LDAP TEST CONNECTION
// ============================================

export async function testLdapConnection(): Promise<boolean> {
  try {
    await bindAdmin();
    console.log('[LDAP] Connection successful');
    return true;
  } catch (error) {
    console.error('[LDAP] Connection test failed:', error);
    return false;
  }
}

// ============================================
// LDAP HEALTH CHECK (startup diagnostics)
// ============================================
// Verifies LDAP connectivity AND validates that the configured
// Base DN actually exists. Logs actionable error messages.

export async function ldapHealthCheck(): Promise<void> {
  const { url, adminDn, baseDn, usersOu, userFilter, mapping } = config.ldap;

  console.log('[LDAP] ─── Health Check ───────────────────────');
  console.log(`[LDAP]   URL           : ${url}`);
  console.log(`[LDAP]   Admin DN      : ${adminDn}`);
  console.log(`[LDAP]   Base DN       : ${baseDn}`);
  console.log(`[LDAP]   Users OU      : ${usersOu || '(root of base DN)'}`);
  console.log(`[LDAP]   User Filter   : ${userFilter}`);
  console.log(`[LDAP]   Attr Mapping  : email=${mapping.email}, firstName=${mapping.firstName}, lastName=${mapping.lastName}, username=${mapping.username}, fullName=${mapping.fullName}, department=${mapping.department}, title=${mapping.title}`);

  // 1. Test bind
  try {
    await bindAdmin();
    console.log('[LDAP]   Bind          : OK');
  } catch (error) {
    console.error('[LDAP]   Bind          : FAILED');
    console.error('[LDAP]   ╰─ Could not authenticate to LDAP server.');
    console.error('[LDAP]   ╰─ Check LDAP_URL, LDAP_ADMIN_DN, and LDAP_ADMIN_PASSWORD.');
    console.log('[LDAP] ──────────────────────────────────────');
    return;
  }

  // 2. Verify Base DN exists
  const baseDnExists = await verifyDnExists(baseDn);
  if (!baseDnExists) {
    console.error('[LDAP]   Base DN       : NOT FOUND');
    console.error(`[LDAP]   ╰─ The Base DN "${baseDn}" does not exist on this server.`);
    console.error('[LDAP]   ╰─ This usually means an environment mismatch.');
    console.error('[LDAP]   ╰─ Check LDAP_BASE_DN in your .env or docker-compose.yml.');
    console.log('[LDAP] ──────────────────────────────────────');
    return;
  }
  console.log('[LDAP]   Base DN       : OK');

  // 3. Verify Users OU (search base) exists
  const searchBase = usersOu ? `${usersOu},${baseDn}` : baseDn;
  if (usersOu) {
    const ouExists = await verifyDnExists(searchBase);
    if (!ouExists) {
      console.error(`[LDAP]   Users OU      : NOT FOUND ("${searchBase}")`);
      console.error('[LDAP]   ╰─ The organizational unit for users does not exist.');
      console.error('[LDAP]   ╰─ Check LDAP_USERS_OU in your .env or docker-compose.yml.');
      console.log('[LDAP] ──────────────────────────────────────');
      return;
    }
    console.log('[LDAP]   Users OU      : OK');
  }

  // 4. Quick count of users matching the filter
  try {
    const users = await searchLdapUsers();
    console.log(`[LDAP]   Users Found   : ${users.length}`);
    if (users.length === 0) {
      console.warn('[LDAP]   ╰─ Warning: Connection is OK but 0 users matched the filter.');
      console.warn(`[LDAP]   ╰─ Search Base: ${searchBase}`);
      console.warn(`[LDAP]   ╰─ Filter: ${userFilter}`);
      console.warn('[LDAP]   ╰─ Check LDAP_USER_FILTER and LDAP_USERS_OU.');
    }
  } catch {
    console.warn('[LDAP]   Users Found   : Could not enumerate (non-fatal)');
  }

  console.log('[LDAP]   Status        : READY');
  console.log('[LDAP] ──────────────────────────────────────');
}

// ============================================
// VERIFY DN EXISTS (helper)
// ============================================

async function verifyDnExists(dn: string): Promise<boolean> {
  return new Promise((resolve) => {
    const client = getClient();
    const opts: ldap.SearchOptions = {
      scope: 'base',
      filter: '(objectClass=*)',
      attributes: ['dn'],
    };

    client.search(dn, opts, (err, res) => {
      if (err) {
        resolve(false);
        return;
      }

      let found = false;
      res.on('searchEntry', () => { found = true; });
      res.on('error', () => { resolve(false); });
      res.on('end', () => { resolve(found); });
    });
  });
}

// ============================================
// LDAP USER INTERFACE
// ============================================

export interface LdapUser {
  dn: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  fullName: string;
  department: string;
  title: string;       // Student | Staff
  faculty: string;     // Derived from OU in DN (engineering, humanities, rectorate)
}

// ============================================
// SEARCH LDAP USERS (generic, config-driven)
// ============================================

export async function searchLdapUsers(): Promise<LdapUser[]> {
  await bindAdmin();

  return new Promise((resolve, reject) => {
    const client = getClient();
    const users: LdapUser[] = [];
    const { mapping } = config.ldap;

    const searchBase = config.ldap.usersOu
      ? `${config.ldap.usersOu},${config.ldap.baseDn}`
      : config.ldap.baseDn;

    // Build the list of LDAP attributes to fetch from the mapping
    const attrs = new Set<string>();
    Object.values(mapping).forEach(attr => attrs.add(attr));
    attrs.add('dn');

    const opts: ldap.SearchOptions = {
      filter: config.ldap.userFilter,
      scope: 'sub',
      attributes: [...attrs],
    };

    client.search(searchBase, opts, (err, res) => {
      if (err) {
        console.error('[LDAP] Search error:', err.message);
        return reject(new Error(`LDAP search failed: ${err.message}`));
      }

      res.on('searchEntry', (entry) => {
        const obj = entry.pojo;

        // Generic attribute extractor — uses the config mapping
        const getAttribute = (name: string): string => {
          const attr = obj.attributes.find(a => a.type === name);
          if (!attr) return '';
          return Array.isArray(attr.values) ? attr.values[0] || '' : '';
        };

        const email = getAttribute(mapping.email);
        if (email) {
          // Extract faculty from the DN path (e.g. ou=engineering,ou=users,... → engineering)
          const dnStr = obj.objectName;
          const ouMatch = dnStr.match(/ou=(\w+),ou=users/i);
          const faculty = ouMatch ? ouMatch[1] : '';

          users.push({
            dn: dnStr,
            email,
            firstName:  getAttribute(mapping.firstName),
            lastName:   getAttribute(mapping.lastName),
            username:   getAttribute(mapping.username),
            fullName:   getAttribute(mapping.fullName),
            department: getAttribute(mapping.department),
            title:      getAttribute(mapping.title),
            faculty,
          });
        }
      });

      res.on('error', (err) => {
        console.error('[LDAP] Search stream error:', err.message);
        reject(new Error(`LDAP search stream error: ${err.message}`));
      });

      res.on('end', (result) => {
        if (result?.status !== 0) {
          console.warn('[LDAP] Search ended with status:', result?.status);
        }
        console.log(`[LDAP] Search completed: ${users.length} users found`);
        resolve(users);
      });
    });
  });
}

// ============================================
// SYNC LDAP USERS TO CAMPAIGN
// ============================================

export interface SyncResult {
  success: boolean;
  totalFound: number;
  synced: number;
  skipped: number;
  errors: number;
  connectionOk: boolean;
  message: string;
  details: Array<{
    email: string;
    status: 'synced' | 'skipped' | 'error';
    message?: string;
  }>;
}

export async function syncLdapUsersToCampaign(campaignId: string): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    totalFound: 0,
    synced: 0,
    skipped: 0,
    errors: 0,
    connectionOk: false,
    message: '',
    details: [],
  };

  // 1. Search LDAP users (this also tests the connection)
  let ldapUsers: LdapUser[];
  try {
    ldapUsers = await searchLdapUsers();
    result.connectionOk = true;
    result.totalFound = ldapUsers.length;
  } catch (error) {
    result.success = false;
    result.connectionOk = false;
    result.message = error instanceof Error
      ? `LDAP connection/search failed: ${error.message}`
      : 'LDAP connection/search failed: Unknown error';
    console.error('[LDAP Sync]', result.message);
    throw error;
  }

  // 2. Handle empty results with a clear diagnostic message
  if (ldapUsers.length === 0) {
    const searchBase = config.ldap.usersOu
      ? `${config.ldap.usersOu},${config.ldap.baseDn}`
      : config.ldap.baseDn;
    result.message =
      `LDAP connection successful but 0 users found. ` +
      `Search Base: "${searchBase}", Filter: "${config.ldap.userFilter}". ` +
      `This may indicate an empty directory or a filter/OU mismatch. ` +
      `Check LDAP_USERS_OU, LDAP_USER_FILTER, and LDAP_ATTR_EMAIL in your environment.`;
    console.warn(`[LDAP Sync] ${result.message}`);
    return result;
  }

  // 3. Sync users to the campaign recipients table
  if (config.useMemoryDb) {
    const now = new Date();
    const existingEmails = new Set(
      memoryStore.recipients
        .filter((r) => r.campaignId === campaignId)
        .map((r) => r.email.toLowerCase())
    );

    for (const user of ldapUsers) {
      const email = user.email.toLowerCase();

      if (existingEmails.has(email)) {
        result.skipped++;
        result.details.push({
          email: user.email,
          status: 'skipped',
          message: 'Already exists',
        });
        continue;
      }

      const recipient: Recipient = {
        id: generateId(),
        campaignId,
        email: user.email,
        firstName: user.firstName || user.fullName || 'Unknown',
        lastName: user.lastName || 'Unknown',
        department: user.department || '',
        faculty: user.faculty || '',
        role: user.title || '',
        token: generateToken(),
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      };

      memoryStore.recipients.push(recipient);
      existingEmails.add(email);
      result.synced++;
      result.details.push({
        email: user.email,
        status: 'synced',
      });
    }
  } else {
    const p = await getPool();
    if (!p) throw new Error('Database not available');

    for (const user of ldapUsers) {
      try {
        const insertResult = await p.query(
          `INSERT INTO recipients (campaign_id, email, first_name, last_name, department, faculty, role, token)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (campaign_id, email) DO NOTHING
           RETURNING id`,
          [
            campaignId,
            user.email,
            user.firstName || user.fullName || 'Unknown',
            user.lastName || 'Unknown',
            user.department || '',
            user.faculty || '',
            user.title || '',
            generateToken(),
          ]
        );

        if (insertResult.rows.length > 0) {
          result.synced++;
          result.details.push({
            email: user.email,
            status: 'synced',
          });
        } else {
          result.skipped++;
          result.details.push({
            email: user.email,
            status: 'skipped',
            message: 'Already exists',
          });
        }
      } catch (dbErr) {
        result.errors++;
        result.details.push({
          email: user.email,
          status: 'error',
          message: dbErr instanceof Error ? dbErr.message : 'Unknown error',
        });
        console.error(`[LDAP Sync] DB Error (${user.email}):`, dbErr);
      }
    }
  }

  result.message = `Sync completed: ${result.synced} synced, ${result.skipped} skipped, ${result.errors} errors`;
  console.log(`[LDAP Sync] ${result.message}`);
  return result;
}

// ============================================
// GET LDAP USERS (Preview without syncing)
// ============================================

// ============================================
// SEARCH LDAP USERS BY FACULTY (targeted sync)
// ============================================

export async function searchLdapUsersByFaculty(faculty: string): Promise<LdapUser[]> {
  const allUsers = await searchLdapUsers();
  if (faculty === 'all' || !faculty) return allUsers;
  return allUsers.filter(u => u.faculty.toLowerCase() === faculty.toLowerCase());
}

// ============================================
// SYNC LDAP USERS BY FACULTY TO CAMPAIGN
// ============================================

export async function syncLdapFacultyToCampaign(campaignId: string, faculty: string): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    totalFound: 0,
    synced: 0,
    skipped: 0,
    errors: 0,
    connectionOk: false,
    message: '',
    details: [],
  };

  let ldapUsers: LdapUser[];
  try {
    ldapUsers = await searchLdapUsersByFaculty(faculty);
    result.connectionOk = true;
    result.totalFound = ldapUsers.length;
  } catch (error) {
    result.success = false;
    result.connectionOk = false;
    result.message = error instanceof Error
      ? `LDAP connection/search failed: ${error.message}`
      : 'LDAP connection/search failed: Unknown error';
    throw error;
  }

  if (ldapUsers.length === 0) {
    result.message = `No users found for faculty "${faculty}".`;
    return result;
  }

  if (config.useMemoryDb) {
    const now = new Date();
    const existingEmails = new Set(
      memoryStore.recipients
        .filter((r) => r.campaignId === campaignId)
        .map((r) => r.email.toLowerCase())
    );

    for (const user of ldapUsers) {
      const email = user.email.toLowerCase();
      if (existingEmails.has(email)) {
        result.skipped++;
        result.details.push({ email: user.email, status: 'skipped', message: 'Already exists' });
        continue;
      }

      const recipient: Recipient = {
        id: generateId(),
        campaignId,
        email: user.email,
        firstName: user.firstName || user.fullName || 'Unknown',
        lastName: user.lastName || 'Unknown',
        department: user.department || '',
        faculty: user.faculty || '',
        role: user.title || '',
        token: generateToken(),
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      };

      memoryStore.recipients.push(recipient);
      existingEmails.add(email);
      result.synced++;
      result.details.push({ email: user.email, status: 'synced' });
    }
  } else {
    const p = await getPool();
    if (!p) throw new Error('Database not available');

    for (const user of ldapUsers) {
      try {
        const insertResult = await p.query(
          `INSERT INTO recipients (campaign_id, email, first_name, last_name, department, faculty, role, token)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (campaign_id, email) DO NOTHING
           RETURNING id`,
          [
            campaignId,
            user.email,
            user.firstName || user.fullName || 'Unknown',
            user.lastName || 'Unknown',
            user.department || '',
            user.faculty || '',
            user.title || '',
            generateToken(),
          ]
        );

        if (insertResult.rows.length > 0) {
          result.synced++;
          result.details.push({ email: user.email, status: 'synced' });
        } else {
          result.skipped++;
          result.details.push({ email: user.email, status: 'skipped', message: 'Already exists' });
        }
      } catch (dbErr) {
        result.errors++;
        result.details.push({
          email: user.email,
          status: 'error',
          message: dbErr instanceof Error ? dbErr.message : 'Unknown error',
        });
      }
    }
  }

  result.message = `Faculty "${faculty}" sync: ${result.synced} synced, ${result.skipped} skipped, ${result.errors} errors`;
  console.log(`[LDAP Sync] ${result.message}`);
  return result;
}

export async function getLdapUsersPreview(): Promise<{
  users: LdapUser[];
  count: number;
  searchBase: string;
  filter: string;
  attributeMapping: typeof config.ldap.mapping;
}> {
  const users = await searchLdapUsers();
  const searchBase = config.ldap.usersOu
    ? `${config.ldap.usersOu},${config.ldap.baseDn}`
    : config.ldap.baseDn;

  return {
    users,
    count: users.length,
    searchBase,
    filter: config.ldap.userFilter,
    attributeMapping: config.ldap.mapping,
  };
}
