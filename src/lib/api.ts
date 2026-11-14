import {
  CrewAccountSummary,
  CrewState,
  GuidelineParameter,
  WarningReport,
  WatchReading,
} from '../types.ts';

const TOKEN_KEY = 'vitanaut_session_token';

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage may be unavailable (private mode); the cookie still works.
  }
}

export async function apiFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(input, { ...init, headers, credentials: 'same-origin' });
}

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data;
}

export interface AuthResponse {
  token: string;
  user: { id: string; crewId: string; role: string };
  state: CrewState;
  accounts: CrewAccountSummary[];
}

export const api = {
  login: (crewId: string, password: string, clientDate: string) =>
    apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ crewId, password, clientDate }),
    }).then((r) => json<AuthResponse>(r)),

  register: (payload: {
    crewId: string;
    password: string;
    crewName: string;
    missionId: string;
    avatarUrl?: string;
    clientDate: string;
  }) =>
    apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then((r) => json<AuthResponse>(r)),

  logout: () => apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined),

  me: () =>
    apiFetch('/api/auth/me').then((r) => json<{ user: { crewId: string }; state: CrewState }>(r)),

  getState: (crewId: string, date: string) =>
    apiFetch(`/api/state/${encodeURIComponent(crewId)}?date=${encodeURIComponent(date)}`).then(
      (r) => json<{ state: CrewState }>(r)
    ),

  saveState: (state: CrewState) =>
    apiFetch(`/api/state/${encodeURIComponent(state.crewId)}`, {
      method: 'PUT',
      body: JSON.stringify({ state }),
    }).then((r) => json<{ state: CrewState }>(r)),

  addWatchReading: (reading: WatchReading) =>
    apiFetch('/api/watch/readings', {
      method: 'POST',
      body: JSON.stringify({ reading }),
    }).then((r) => json<{ inserted: number }>(r)),

  watchReadings: (limit = 200) =>
    apiFetch(`/api/watch/readings?limit=${limit}`).then((r) => json<{ readings: WatchReading[] }>(r)),

  history: (limit = 50, offset = 0) =>
    apiFetch(`/api/history?limit=${limit}&offset=${offset}`).then((r) =>
      json<{ entries: unknown[]; total: number }>(r)
    ),

  warnings: () => apiFetch('/api/warnings').then((r) => json<WarningReport>(r)),

  parameters: () =>
    apiFetch('/api/parameters').then((r) => json<{ parameters: GuidelineParameter[] }>(r)),
};
