import crypto from 'node:crypto';
import { getDb } from './db.ts';

const SESSION_DAYS = 30;

export interface SessionUser {
  id: string;
  crewId: string;
  role: string;
}

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

/**
 * Sessions are signed tokens rather than database rows.
 *
 * Vercel may serve consecutive requests from different serverless instances,
 * each with its own /tmp SQLite file. A database-backed session would be
 * rejected on the second instance. The HMAC payload lets every instance verify
 * the login without shared state. The local database row is still written when
 * available for auditing, but it is not required to authenticate.
 */
const SECRET =
  process.env.VITANAUT_SESSION_SECRET?.trim() ||
  'vitanaut-development-session-secret-change-before-production';

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}

interface SessionPayload {
  sub: string;
  crewId: string;
  role: string;
  exp: number;
}

export function createSession(
  userId: string,
  crewId: string,
  role: string
): { token: string; expiresAt: string } {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString();
  const payload: SessionPayload = {
    sub: userId,
    crewId,
    role,
    exp: new Date(expiresAt).getTime(),
  };
  const encoded = b64url(JSON.stringify(payload));
  const token = `${encoded}.${sign(encoded)}`;

  // Best-effort audit trail; a missing row must never break authentication.
  try {
    getDb()
      .prepare(
        'INSERT OR REPLACE INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
      )
      .run(sha256(token), userId, new Date().toISOString(), expiresAt);
  } catch {
    // Serverless instances may have a fresh database; the signed token is enough.
  }

  return { token, expiresAt };
}

export function resolveSession(token: string): SessionUser | undefined {
  try {
    const revoked = getDb()
      .prepare('SELECT 1 FROM revoked_sessions WHERE token_hash = ?')
      .pluck()
      .get(sha256(token));
    if (revoked) return undefined;
  } catch {
    // A fresh instance may not have the audit table yet; the signature is
    // still cryptographically valid.
  }
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return undefined;

  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return undefined;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
  } catch {
    return undefined;
  }

  if (
    !payload.sub ||
    !payload.crewId ||
    typeof payload.exp !== 'number' ||
    payload.exp < Date.now()
  ) {
    return undefined;
  }

  return { id: payload.sub, crewId: payload.crewId, role: payload.role || 'astronaut' };
}

export function revokeSession(token: string): void {
  const hash = sha256(token);
  try {
    getDb()
      .prepare(
        'INSERT OR REPLACE INTO revoked_sessions (token_hash, revoked_at, expires_at) VALUES (?, ?, ?)'
      )
      .run(hash, new Date().toISOString(), new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString());
    getDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash);
  } catch {
    // Logout still clears the browser token even if the audit DB is unavailable.
  }
}
export function revokeAllSessions(userId: string): void {
  try {
    const rows = getDb()
      .prepare('SELECT token_hash, expires_at FROM sessions WHERE user_id = ?')
      .all(userId) as Array<{ token_hash: string; expires_at: string }>;
    const revoke = getDb().prepare(
      'INSERT OR REPLACE INTO revoked_sessions (token_hash, revoked_at, expires_at) VALUES (?, ?, ?)'
    );
    const now = new Date().toISOString();
    for (const row of rows) revoke.run(row.token_hash, now, row.expires_at);
    getDb().prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  } catch {
    // Best effort on a stateless instance.
  }
}
export function purgeExpiredSessions(): void {
  const now = new Date().toISOString();
  getDb().prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
  getDb().prepare('DELETE FROM revoked_sessions WHERE expires_at < ?').run(now);
}
export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

export const SESSION_COOKIE = 'vitanaut_session';

export function sessionCookie(token: string, expiresAt: string): string {
  const maxAge = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}
