const API_BASE = 'http://localhost:3001/api';
const WS_BASE = 'ws://localhost:3001/ws';

let accessToken: string | null = sessionStorage.getItem('accessToken');
let refreshToken: string | null = sessionStorage.getItem('refreshToken');

function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  sessionStorage.setItem('accessToken', access);
  sessionStorage.setItem('refreshToken', refresh);
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  sessionStorage.removeItem('accessToken');
  sessionStorage.removeItem('refreshToken');
  sessionStorage.removeItem('user');
}

export function getAccessToken() { return accessToken; }

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && retry && refreshToken) {
    try {
      const r = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (r.ok) {
        const data = await r.json();
        setTokens(data.accessToken, data.refreshToken);
        return request<T>(path, options, false);
      }
    } catch {}
    clearTokens();
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }

  const text = await res.text();
  return text ? JSON.parse(text) : undefined;
}

// ── Auth ────────────────────────────────────────────────────────────────────
export const auth = {
  register: (data: object) => request<{ user: User; accessToken: string; refreshToken: string }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (email: string, password: string) => request<{ user: User; accessToken: string; refreshToken: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: (rt: string) => request('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: rt }) }),
  initTokens: setTokens,
};

// ── Alumni ──────────────────────────────────────────────────────────────────
export const alumni = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ data: AlumniProfile[]; total: number }>(`/alumni${qs}`);
  },
  get: (id: string) => request<AlumniProfile>(`/alumni/${id}`),
  updateProfile: (data: object) => request<AlumniProfile>('/alumni/profile', { method: 'PATCH', body: JSON.stringify(data) }),
  getMyProfile: () => request<AlumniProfile | StudentProfile>('/alumni/me/profile'),
};

// ── Requests ────────────────────────────────────────────────────────────────
export const requests = {
  submit: (data: object) => request<MentorshipRequest>('/requests', { method: 'POST', body: JSON.stringify(data) }),
  list: () => request<MentorshipRequest[]>('/requests'),
  get: (id: string) => request<MentorshipRequest>(`/requests/${id}`),
  accept: (id: string) => request(`/requests/${id}/accept`, { method: 'PATCH' }),
  decline: (id: string) => request(`/requests/${id}/decline`, { method: 'PATCH' }),
  withdraw: (id: string) => request(`/requests/${id}/withdraw`, { method: 'PATCH' }),
};

// ── Connections ─────────────────────────────────────────────────────────────
export const connections = {
  list: () => request<Connection[]>('/connections'),
  get: (id: string) => request<Connection>(`/connections/${id}`),
  messages: (id: string, page = 1) => request<{ messages: ChatMessage[]; total: number }>(`/connections/${id}/messages?page=${page}`),
  sendMessage: (id: string, content: string) => request<ChatMessage>(`/connections/${id}/messages`, { method: 'POST', body: JSON.stringify({ content }) }),
  uploadFile: async (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/connections/${id}/messages/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
    return res.json();
  },
  proposeSessions: (id: string, data: object) => request<Session>(`/connections/${id}/sessions`, { method: 'POST', body: JSON.stringify(data) }),
  getSessions: (id: string) => request<Session[]>(`/connections/${id}/sessions`),
};

// ── Sessions ────────────────────────────────────────────────────────────────
export const sessions = {
  confirm: (id: string) => request<Session>(`/sessions/${id}/confirm`, { method: 'PATCH' }),
  cancel: (id: string) => request<Session>(`/sessions/${id}/cancel`, { method: 'PATCH' }),
  attendance: (id: string, attended: boolean) => request<Session>(`/sessions/${id}/attendance`, { method: 'PATCH', body: JSON.stringify({ attended }) }),
};

// ── Notifications ───────────────────────────────────────────────────────────
export const notifications = {
  list: () => request<NotificationEvent[]>('/notifications'),
  updatePreferences: (cadence: 'daily' | 'weekly') => request('/notifications/preferences', { method: 'PATCH', body: JSON.stringify({ cadence }) }),
  markAllRead: () => request('/notifications/mark-all-read', { method: 'PATCH' }),
  toggleRead: (id: string) => request<NotificationEvent>(`/notifications/${id}/toggle`, { method: 'PATCH' }),
};

// ── Admin ───────────────────────────────────────────────────────────────────
export const admin = {
  verificationQueue: () => request<VerificationRecord[]>('/admin/verification-queue'),
  advance: (id: string) => request(`/admin/verification/${id}/advance`, { method: 'PATCH' }),
  reject: (id: string, reason: string) => request(`/admin/verification/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
  metrics: () => request<AdminMetrics>('/admin/metrics'),
  flaggedConnections: () => request<Connection[]>('/admin/flagged-connections'),
  domains: () => request<DomainTag[]>('/admin/domains'),
  createDomain: (name: string) => request<DomainTag>('/admin/domains', { method: 'POST', body: JSON.stringify({ name }) }),
  updateDomain: (id: string, data: object) => request<DomainTag>(`/admin/domains/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};

// ── WebSocket factory ───────────────────────────────────────────────────────
export function createChatWebSocket(connectionId: string): WebSocket {
  return new WebSocket(`${WS_BASE}/connections/${connectionId}?token=${accessToken}`);
}

// ── Types ───────────────────────────────────────────────────────────────────
export interface User { id: string; email: string; role: 'student' | 'alumni' | 'admin'; fullName: string; profilePhotoUrl?: string; }
export interface AlumniProfile { id: string; userId: string; bio?: string; company?: string; jobTitle?: string; experienceYears?: number; linkedinUrl?: string; verificationStatus: string; availabilityStatus: string; rankingScore: number; sessionsConducted: number; responseRate: number; profileCompletenessScore: number; domainTags: DomainTag[]; user: User; }
export interface StudentProfile { id: string; userId: string; university?: string; graduationYear?: number; interestTags: DomainTag[]; user: User; }
export interface DomainTag { id: string; name: string; status: string; }
export interface MentorshipRequest { id: string; studentId: string; alumniId: string; message: string; goals?: string; status: string; createdAt: string; student?: User; alumni?: User & { alumniProfile?: AlumniProfile }; }
export interface Connection { id: string; studentId: string; alumniId: string; createdAt: string; healthScore: number; isFlagged: boolean; student?: User; alumni?: User & { alumniProfile?: AlumniProfile }; request?: MentorshipRequest; }
export interface ChatMessage { id: string; connectionId: string; senderId: string; messageType: 'text' | 'file'; content?: string; fileUrl?: string; fileName?: string; sentAt: string; sender?: User; }
export interface Session { id: string; connectionId: string; proposedById: string; slotStart: string; slotEnd: string; status: string; meetingLink?: string; studentAttended?: boolean; alumniAttended?: boolean; }
export interface NotificationEvent { id: string; userId: string; eventType: string; payload: Record<string, unknown>; isDigested: boolean; createdAt: string; }
export interface VerificationRecord { id: string; alumniProfileId: string; stage: string; rejectionReason?: string; submittedAt: string; alumniProfile?: AlumniProfile; }
export interface AdminMetrics { totalUsers: number; totalAlumni: number; totalStudents: number; totalConnections: number; totalSessionsCompleted: number; pendingRequests: number; flaggedConnections: number; activeMentorsByDomain: { tag: string; count: number }[]; }
