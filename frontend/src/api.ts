import type {
  Campaign,
  CampaignDetail,
  EventType,
  Recipient,
  EmailTemplate,
  LandingPage,
  DashboardStats,
  DepartmentStat,
  LdapUser,
  LdapFaculty,
  LdapSyncResult,
  CampaignFormData,
  Attachment,
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

/** Returns the full URL for the landing page preview endpoint (for iframe src) */
export function getPreviewUrl(pageId: string): string {
  return `${API_BASE_URL}/landing-pages/preview/${pageId}`;
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = localStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Paths that should NEVER trigger a logout redirect on 401/429.
 * These are asset paths that cloned landing pages might request —
 * they hit the backend but are NOT real API calls.
 */
const AUTH_IGNORE_PATTERNS = [
  '/partials/', '/templates/', '/views/', '/assets/',
  '/bower_components/', '/node_modules/', '/vendor/',
  '/static/', '/landing-pages/preview/',
];

function isAssetPath(url: string): boolean {
  return AUTH_IGNORE_PATTERNS.some((p) => url.includes(p));
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: getAuthHeaders(),
    ...options,
  });

  if (response.status === 401 && !isAssetPath(path)) {
    // Only clear auth for real API 401s — NOT for phantom asset fetches
    localStorage.removeItem('token');
    localStorage.removeItem('admin');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request<{ token: string; admin: { id: string; username: string; role: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  getMe: () =>
    request<{ admin: { id: string; username: string; role: string } }>('/auth/me'),

  // Health check
  healthCheck: () => request<{ ok: boolean; database: string }>('/health'),

  // Dashboard
  getDashboardStats: () => request<DashboardStats>('/dashboard/stats'),
  getDepartmentStats: () => request<DepartmentStat[]>('/dashboard/departments'),
  getAllUsers: (params?: { page?: number; pageSize?: number; faculty?: string; search?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.pageSize) q.set('pageSize', String(params.pageSize));
    if (params?.faculty) q.set('faculty', params.faculty);
    if (params?.search) q.set('search', params.search);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    return request<{ users: Recipient[]; total: number; page: number; pageSize: number }>(`/dashboard/users${qs ? `?${qs}` : ''}`);
  },

  // Campaigns
  getCampaigns: () => request<Campaign[]>('/campaigns'),

  getCampaign: (id: string) => request<CampaignDetail>(`/campaigns/${id}`),

  createCampaign: (data: Partial<CampaignFormData> & { name: string }) =>
    request<Campaign>('/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCampaign: (id: string, data: { name?: string; description?: string; targetCount?: number }) =>
    request<Campaign>(`/campaigns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteCampaign: (id: string) =>
    request<{ success: boolean }>(`/campaigns/${id}`, { method: 'DELETE' }),

  startCampaign: (id: string) =>
    request<Campaign>(`/campaigns/${id}/start`, { method: 'POST' }),

  pauseCampaign: (id: string) =>
    request<Campaign>(`/campaigns/${id}/pause`, { method: 'POST' }),

  resumeCampaign: (id: string) =>
    request<Campaign>(`/campaigns/${id}/resume`, { method: 'POST' }),

  completeCampaign: (id: string) =>
    request<Campaign>(`/campaigns/${id}/complete`, { method: 'POST' }),

  // Recipients
  getRecipients: (campaignId: string) =>
    request<Recipient[]>(`/campaigns/${campaignId}/recipients`),

  addRecipient: (campaignId: string, data: { email: string; firstName: string; lastName: string }) =>
    request<Recipient>(`/campaigns/${campaignId}/recipients`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  addRecipientsBulk: (campaignId: string, recipients: Array<{ email: string; firstName: string; lastName: string }>) =>
    request<{ success: boolean; count: number }>(`/campaigns/${campaignId}/recipients/bulk`, {
      method: 'POST',
      body: JSON.stringify({ recipients }),
    }),

  deleteRecipient: (id: string) =>
    request<{ success: boolean }>(`/recipients/${id}`, { method: 'DELETE' }),

  // Email Templates
  getTemplates: () => request<EmailTemplate[]>('/templates'),

  getTemplate: (id: string) => request<EmailTemplate>(`/templates/${id}`),

  createTemplate: (data: { name: string; subject: string; body: string; category?: string; isDefault?: boolean }) =>
    request<EmailTemplate>('/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTemplate: (id: string, data: { name?: string; subject?: string; body?: string; category?: string; isDefault?: boolean }) =>
    request<EmailTemplate>(`/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteTemplate: (id: string) =>
    request<{ success: boolean }>(`/templates/${id}`, { method: 'DELETE' }),

  // Landing Pages
  getLandingPages: () => request<LandingPage[]>('/landing-pages'),

  getLandingPage: (id: string) => request<LandingPage>(`/landing-pages/${id}`),

  createLandingPage: (data: { name: string; html: string; slug?: string; originalUrl?: string; isCloned?: boolean; isDefault?: boolean }) =>
    request<LandingPage>('/landing-pages', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateLandingPage: (id: string, data: { name?: string; html?: string; slug?: string; isDefault?: boolean }) =>
    request<LandingPage>(`/landing-pages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteLandingPage: (id: string) =>
    request<{ success: boolean }>(`/landing-pages/${id}`, { method: 'DELETE' }),

  // Site Cloner (static mirror — auto-creates landing page)
  cloneSite: (url: string) =>
    request<{ id: string; title: string; originalUrl: string; staticPath: string; assetCount: number }>('/clone', {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),

  // ZIP Upload (manual template upload)
  uploadLandingPageZip: async (file: File, name?: string): Promise<{ id: string; name: string; staticPath: string; fileCount: number }> => {
    const formData = new FormData();
    formData.append('file', file);
    if (name) formData.append('name', name);

    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/landing-pages/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('admin');
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || `Upload failed: ${response.status}`);
    }

    return response.json();
  },

  // Events
  trackEvent: (data: { type: EventType; campaignId: string; recipientToken: string }) =>
    request<{ success: boolean }>('/events', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // LDAP
  testLdapConnection: () =>
    request<{ success: boolean; message: string }>('/ldap/test'),

  getLdapUsers: (faculty?: string) =>
    request<{ users: LdapUser[]; count: number }>(`/ldap/users${faculty ? `?faculty=${faculty}` : ''}`),

  getLdapFaculties: () =>
    request<{ faculties: LdapFaculty[]; total: number }>('/ldap/faculties'),

  syncLdapUsers: (campaignId: string, faculty?: string) =>
    request<LdapSyncResult>(`/ldap/sync/${campaignId}`, {
      method: 'POST',
      body: JSON.stringify({ faculty: faculty || 'all' }),
    }),

  // Attachments
  getAttachments: () => request<Attachment[]>('/attachments'),

  uploadAttachment: async (file: File): Promise<Attachment> => {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/attachments/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('admin');
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || `Upload failed: ${response.status}`);
    }

    return response.json();
  },

  deleteAttachment: (id: string) =>
    request<{ success: boolean }>(`/attachments/${id}`, { method: 'DELETE' }),
};
