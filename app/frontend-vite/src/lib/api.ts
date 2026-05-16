const BASE_URL = (import.meta.env.VITE_API_URL as string) || '/api';
// Always same-origin (/api, /ws on :8000). Dev: Vite proxies to Django. Prod: Django direct.
const WS_BASE = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;

function getToken(key: 'access_token' | 'refresh_token') {
  return localStorage.getItem(key);
}

function getGuestToken() {
  return localStorage.getItem('guest_token');
}

async function request(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken('access_token');
  const guestToken = getGuestToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!token && guestToken) headers['X-Guest-Token'] = guestToken;

  let res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    const refresh = getToken('refresh_token');
    if (refresh) {
      const refreshRes = await fetch(`${BASE_URL}/auth/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      });
      if (refreshRes.ok) {
        const { access } = await refreshRes.json();
        localStorage.setItem('access_token', access);
        headers['Authorization'] = `Bearer ${access}`;
        res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
      } else {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      }
    }
  }

  return res;
}

/**
 * Open a relay WebSocket to the Django backend for a chat session with an AI profile.
 *
 * Messages flow:  Frontend → Django → AI Agent → Django → Frontend
 *
 * @param profileId  The Profile.id of the AI being chatted with
 * @param onMessage  Called with every parsed JSON message from the agent
 * @param onClose    Called when the socket closes (optional)
 * @returns The WebSocket instance — call .send(JSON.stringify({...})) to talk to the agent
 */
export function createChatSocket(
  profileId: string | number,
  onMessage: (data: Record<string, unknown>) => void,
  onClose?: () => void,
): WebSocket {
  const token = getToken('access_token') ?? '';
  const ws = new WebSocket(`${WS_BASE}/ws/chat/${profileId}/?token=${token}`);

  ws.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data as string));
    } catch {
      onMessage({ type: 'raw', message: event.data });
    }
  };

  if (onClose) ws.onclose = onClose;

  return ws;
}

// No Auth0 SDK on the frontend — Django handles the full OAuth flow.
// api.setTokenGetter is a no-op kept for API compatibility.
export const api = {
  setTokenGetter(_fn: (() => Promise<string>) | null) { /* noop */ },

  async login(email: string) {
    const res = await fetch(`${BASE_URL}/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) return null;
    return res.json() as Promise<{ access: string; refresh: string }>;
  },

  async syncUser() { return null; },

  async me() {
    const res = await request('/auth/me/');
    if (!res.ok) return null;
    return res.json() as Promise<{ user: { id: number; email: string }; profile: unknown }>;
  },

  async getProfiles() {
    const res = await request('/profiles/');
    if (!res.ok) return [];
    return res.json();
  },

  async getProfile(id: string | number) {
    const res = await request(`/profiles/${id}/`);
    if (!res.ok) return null;
    return res.json();
  },

  async getMyProfile() {
    const res = await request('/profiles/me/');
    if (!res.ok) return null;
    return res.json();
  },

  async saveMyProfile(data: Record<string, unknown>) {
    const res = await request('/profiles/me/', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: Object.values(json).flat().join(' ') };
    return { data: json, error: null };
  },

  async getMyAvatars() {
    const res = await request('/profiles/me/avatar/');
    if (!res.ok) return [];
    return res.json() as Promise<{ id: number; url: string; active: boolean }[]>;
  },

  async uploadAvatar(file: File) {
    const token = getToken('access_token');
    const body = new FormData();
    body.append('avatar', file);
    const res = await fetch(`${BASE_URL}/profiles/me/avatar/`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body,
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: (json.detail as string) ?? 'Upload failed' };
    return { data: json as { id: number; url: string; active: boolean }[], error: null };
  },

  async activateAvatar(id: number) {
    const res = await request(`/profiles/me/avatar/${id}/`, { method: 'POST' });
    if (!res.ok) return null;
    return res.json() as Promise<{ id: number; url: string; active: boolean }[]>;
  },

  async deleteAvatar(id: number) {
    const res = await request(`/profiles/me/avatar/${id}/`, { method: 'DELETE' });
    if (!res.ok) return null;
    return res.json() as Promise<{ id: number; url: string; active: boolean }[]>;
  },

  async getMyBanners() {
    const res = await request('/profiles/me/banner/');
    if (!res.ok) return [];
    return res.json() as Promise<{ id: number; url: string; active: boolean }[]>;
  },

  async uploadBanner(file: File) {
    const token = getToken('access_token');
    const body = new FormData();
    body.append('banner', file);
    const res = await fetch(`${BASE_URL}/profiles/me/banner/`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body,
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: (json.detail as string) ?? 'Upload failed' };
    return { data: json as { id: number; url: string; active: boolean }[], error: null };
  },

  async activateBanner(id: number) {
    const res = await request(`/profiles/me/banner/${id}/`, { method: 'POST' });
    if (!res.ok) return null;
    return res.json() as Promise<{ id: number; url: string; active: boolean }[]>;
  },

  async deleteBanner(id: number) {
    const res = await request(`/profiles/me/banner/${id}/`, { method: 'DELETE' });
    if (!res.ok) return null;
    return res.json() as Promise<{ id: number; url: string; active: boolean }[]>;
  },

  async getMyPersonalImages() {
    const res = await request('/profiles/me/images/');
    if (!res.ok) return [];
    return res.json() as Promise<{ id: number; url: string }[]>;
  },

  async uploadPersonalImage(file: File) {
    const token = getToken('access_token');
    const body = new FormData();
    body.append('image', file);
    const res = await fetch(`${BASE_URL}/profiles/me/images/`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body,
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: (json.detail as string) ?? 'Upload failed' };
    return { data: json as { id: number; url: string }, error: null };
  },

  async deletePersonalImage(id: number) {
    const res = await request(`/profiles/me/images/${id}/`, { method: 'DELETE' });
    return res.ok;
  },

  async getCompatibility(profileId: string | number): Promise<CompatibilityBreakdown[]> {
    const res = await request(`/profiles/${profileId}/compatibility/`);
    if (!res.ok) return [];
    return res.json();
  },

  async voteCompatibility(profileId: string | number, category: string, value: number): Promise<CompatibilityBreakdown[]> {
    const res = await request(`/profiles/${profileId}/compatibility/${category}/vote/`, {
      method: 'POST',
      body: JSON.stringify({ value }),
    });
    if (!res.ok) return [];
    return res.json();
  },

  async heartbeat(): Promise<void> {
    await request('/profiles/me/heartbeat/', { method: 'POST' });
  },

  async createGuestSession(): Promise<string | null> {
    const res = await fetch(`${BASE_URL}/guest-session/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.token as string;
  },

  async getChatHistory(profileId: string | number): Promise<ChatMessage[]> {
    const res = await request(`/profiles/${profileId}/chat/`);
    if (!res.ok) return [];
    return res.json();
  },

  async postChatMessage(
    profileId: string | number,
    role: 'user' | 'assistant',
    content: string,
  ): Promise<ChatMessage | null> {
    const res = await request(`/profiles/${profileId}/chat/`, {
      method: 'POST',
      body: JSON.stringify({ role, content }),
    });
    if (!res.ok) return null;
    return res.json();
  },

  async claimGuestSession(token: string): Promise<number> {
    const res = await request('/chat/claim/', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return (data.merged as number) ?? 0;
  },
};

export interface CompatibilityBreakdown {
  category: string;
  label: string;
  ai_score: number;
  human_score: number | null;
  vote_count: number;
  my_vote: number | null;
  combined: number;
}

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}
