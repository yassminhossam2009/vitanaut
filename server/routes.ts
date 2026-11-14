import { Router, Request, Response, NextFunction } from 'express';
import {
  audit,
  composeState,
  createUser,
  findUserByCrewId,
  findUserById,
  insertWatchReading,
  listAccounts,
  listHistory,
  listParameters,
  listWatchReadings,
  saveState,
  touchLogin,
  upsertParameters,
  watchSummary,
  WatchReadingInput,
  RefParameter,
} from './db.ts';
import { hashPassword, verifyPassword } from './passwords.ts';
import {
  clearSessionCookie,
  createSession,
  parseCookies,
  resolveSession,
  revokeSession,
  SESSION_COOKIE,
  sessionCookie,
} from './sessions.ts';
import { CrewState, MissionId, WatchReading } from '../src/types.ts';
import { createSeedCrewState } from '../src/data/seedCrewState.ts';
import { evaluateWarnings } from './warnings.ts';
import { applyDailyHabitReset, getSystemDateKey } from '../src/utils/dailyReset.ts';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; crewId: string; role: string };
    }
  }
}

export const router = Router();

/* ------------------------------------------------------------ helpers */

function bearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return parseCookies(req.headers.cookie)[SESSION_COOKIE];
}

function authenticate(req: Request): boolean {
  const token = bearerToken(req);
  if (!token) return false;
  const session = resolveSession(token);
  if (!session) return false;

  // Vercel instances each seed their own SQLite file, so user UUIDs can differ
  // between instances. Resolve the local row by the stable crew ID and keep the
  // signed claims as a fallback for a user created on another instance.
  const local = findUserByCrewId(session.crewId);
  req.user = local
    ? { id: local.id, crewId: local.crew_id, role: local.role }
    : session;
  return true;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!authenticate(req)) {
    res.status(401).json({ error: 'Sign in to continue.' });
    return;
  }
  next();
}

export function requireSelf(req: Request, res: Response, next: NextFunction) {
  if (!authenticate(req)) {
    res.status(401).json({ error: 'Sign in to continue.' });
    return;
  }
  const requested = String(req.params.crewId ?? '').trim().toUpperCase();
  if (requested !== req.user!.crewId.toUpperCase()) {
    res.status(403).json({ error: 'This profile belongs to another crew member.' });
    return;
  }
  next();
}

function clientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
}

function safeDate(value: unknown): string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : getSystemDateKey();
}

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
function throttled(key: string): boolean {
  const rec = loginAttempts.get(key);
  if (!rec || rec.resetAt < Date.now()) return false;
  return rec.count >= 8;
}
function noteFailure(key: string) {
  const rec = loginAttempts.get(key);
  if (!rec || rec.resetAt < Date.now()) {
    loginAttempts.set(key, { count: 1, resetAt: Date.now() + 10 * 60_000 });
  } else {
    rec.count += 1;
  }
}

function issueSession(res: Response, userId: string, crewId: string, role: string) {
  const { token, expiresAt } = createSession(userId, crewId, role);
  res.setHeader('Set-Cookie', sessionCookie(token, expiresAt));
  return { token, expiresAt, user: { id: userId, crewId, role } };
}

/* --------------------------------------------------------------- auth */

router.post('/auth/register', (req, res) => {
  const { crewId, password, crewName, missionId, avatarUrl, clientDate } = req.body ?? {};
  const normalizedId = String(crewId ?? '').trim().toUpperCase();
  const cleanName = String(crewName ?? '').trim();
  const pw = String(password ?? '');

  if (!cleanName || !normalizedId || !pw || pw.length < 4) {
    res.status(400).json({ error: 'Provide your Name, Crew ID, and a password of at least 4 characters.' });
    return;
  }
  if (!/^[A-Z0-9][A-Z0-9-]{2,15}$/.test(normalizedId)) {
    res.status(400).json({ error: 'Crew ID must be 3-16 characters: letters, numbers or dashes.' });
    return;
  }
  if (cleanName.length > 60) {
    res.status(400).json({ error: 'Name is too long.' });
    return;
  }
  if (findUserByCrewId(normalizedId)) {
    res.status(409).json({ error: 'This Crew ID already exists. Choose a different ID or sign in.' });
    return;
  }

  const safeMission = Object.values(MissionId).includes(missionId) ? missionId : MissionId.ISS;
  const user = createUser(normalizedId, hashPassword(pw));

  // Build the starting state with the same seed used by the app.
  const state = createSeedCrewState(
    normalizedId,
    cleanName,
    safeMission,
    String(avatarUrl ?? '').trim() || undefined,
    safeDate(clientDate)
  );
  saveState(user.id, state);
  for (const w of state.watchReadings ?? []) insertWatchReading(user.id, w);

  const session = issueSession(res, user.id, user.crew_id, user.role);
  audit(user.id, 'account.created', normalizedId, clientIp(req));
  res.status(201).json({ ...session, state: composeState(user.id), accounts: listAccounts() });
});

router.post('/auth/login', (req, res) => {
  const { crewId, password, missionId, clientDate } = req.body ?? {};
  const normalizedId = String(crewId ?? '').trim().toUpperCase();
  const pw = String(password ?? '');
  const ip = clientIp(req);
  const key = `${ip}:${normalizedId}`;

  if (!normalizedId || !pw) {
    res.status(400).json({ error: 'Crew ID and password are required.' });
    return;
  }
  if (throttled(key)) {
    res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
    return;
  }

  const user = findUserByCrewId(normalizedId);
  if (!user || !verifyPassword(pw, user.password_hash)) {
    noteFailure(key);
    audit(user?.id ?? null, 'auth.failed', normalizedId, ip);
    res.status(401).json({
      error: user ? 'Invalid password for this Crew ID.' : 'Crew ID not found. Create a new account or choose an existing crew member.',
    });
    return;
  }

  loginAttempts.delete(key);
  touchLogin(user.id);

  if (missionId && Object.values(MissionId).includes(missionId)) {
    const state = composeState(user.id);
    if (state) saveState(user.id, { ...state, missionId });
  }

  const state = composeState(user.id);
  if (!state) {
    res.status(500).json({ error: 'Profile missing for this account.' });
    return;
  }
  const { state: resetState, needsPersist } = applyDailyHabitReset(state, safeDate(clientDate));
  const finalState = needsPersist ? saveState(user.id, resetState) : resetState;

  const session = issueSession(res, user.id, user.crew_id, user.role);
  audit(user.id, 'auth.login', normalizedId, ip);
  res.json({ ...session, state: finalState, accounts: listAccounts() });
});

router.post('/auth/logout', (req, res) => {
  const token = bearerToken(req);
  if (token) revokeSession(token);
  if (req.user) audit(req.user.id, 'auth.logout', undefined, clientIp(req));
  res.setHeader('Set-Cookie', clearSessionCookie());
  res.json({ ok: true });
});

router.get('/auth/me', requireAuth, (req, res) => {
  const user = findUserById(req.user!.id)!;
  res.json({
    user: { id: user.id, crewId: user.crew_id, role: user.role, createdAt: user.created_at },
    state: composeState(user.id),
  });
});

router.get('/crew/accounts', (_req, res) => {
  res.json({ accounts: listAccounts() });
});

/* --------------------------------------------------------------- state */

router.get('/state/:crewId', requireSelf, (req, res) => {
  const state = composeState(req.user!.id);
  if (!state) {
    res.status(404).json({ error: 'Crew profile not found.' });
    return;
  }
  const { state: resetState, needsPersist } = applyDailyHabitReset(state, safeDate(req.query.date));
  res.json({ state: needsPersist ? saveState(req.user!.id, resetState) : resetState });
});

router.put('/state/:crewId', requireSelf, (req, res) => {
  const nextState = req.body?.state as CrewState | undefined;
  if (!nextState || nextState.crewId.toUpperCase() !== req.user!.crewId.toUpperCase()) {
    res.status(400).json({ error: 'Invalid crew state payload.' });
    return;
  }
  const saved = saveState(req.user!.id, nextState);
  res.json({ state: saved });
});

/* ------------------------------------------------------------ wearable */

const numeric = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

function validateReading(raw: any): { ok: true; value: WatchReadingInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Reading must be an object.' };
  const id = String(raw.id ?? '').slice(0, 80);
  const timestamp = String(raw.timestamp ?? '');
  if (!id) return { ok: false, error: 'Reading id is required (used for idempotent sync).' };
  if (!timestamp || Number.isNaN(Date.parse(timestamp))) return { ok: false, error: 'Reading timestamp must be ISO-8601.' };

  const hr = numeric(raw.heartRateBpm);
  const hrv = numeric(raw.hrvMs);
  const spo2 = numeric(raw.spo2Percent);
  const stress = numeric(raw.stressIndex);
  const sleep = numeric(raw.sleepHours);
  const deep = numeric(raw.deepSleepPercent);
  const bone = numeric(raw.boneLoadKn);
  const active = numeric(raw.activeMinutes);

  const fail = (field: string, min: number, max: number) =>
    ({ ok: false as const, error: `${field} must be between ${min} and ${max}.` });

  if (hr === null || hr < 25 || hr > 240) return fail('heartRateBpm', 25, 240);
  if (hrv === null || hrv < 1 || hrv > 300) return fail('hrvMs', 1, 300);
  if (spo2 === null || spo2 < 50 || spo2 > 100) return fail('spo2Percent', 50, 100);
  if (stress === null || stress < 0 || stress > 100) return fail('stressIndex', 0, 100);
  if (sleep === null || sleep < 0 || sleep > 24) return fail('sleepHours', 0, 24);
  if (deep === null || deep < 0 || deep > 100) return fail('deepSleepPercent', 0, 100);
  if (bone === null || bone < 0 || bone > 10) return fail('boneLoadKn', 0, 10);
  if (active === null || active < 0 || active > 1440) return fail('activeMinutes', 0, 1440);

  return {
    ok: true,
    value: {
      id,
      timestamp,
      heartRateBpm: hr,
      hrvMs: hrv,
      spo2Percent: spo2,
      stressIndex: stress,
      sleepHours: sleep,
      deepSleepPercent: deep,
      boneLoadKn: bone,
      activeMinutes: active,
      source: raw.source === 'manual_entry' ? 'manual_entry' : 'wearable_sync',
      deviceId: raw.deviceId ? String(raw.deviceId).slice(0, 80) : undefined,
    },
  };
}

router.post('/watch/readings', requireAuth, (req, res) => {
  const body = req.body ?? {};
  const list: any[] = Array.isArray(body.readings) ? body.readings : [body.reading ?? body];
  if (list.length === 0 || list.length > 500) {
    res.status(400).json({ error: 'Send between 1 and 500 readings.' });
    return;
  }
  const accepted: WatchReading[] = [];
  const errors: string[] = [];
  for (const item of list) {
    const result = validateReading(item);
    if (!result.ok) {
      errors.push(result.error);
      continue;
    }
    accepted.push(insertWatchReading(req.user!.id, result.value));
  }
  if (accepted.length === 0) {
    res.status(422).json({ error: errors[0] ?? 'No valid readings.', errors });
    return;
  }
  audit(req.user!.id, 'watch.ingest', `${accepted.length} readings`, clientIp(req));
  res.status(201).json({ inserted: accepted.length, rejected: errors.length, errors, readings: accepted });
});

router.get('/watch/readings', requireAuth, (req, res) => {
  const readings = listWatchReadings(req.user!.id, {
    limit: Number(req.query.limit) || undefined,
    from: typeof req.query.from === 'string' ? req.query.from : undefined,
    to: typeof req.query.to === 'string' ? req.query.to : undefined,
  });
  res.json({ readings });
});

router.get('/watch/summary', requireAuth, (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 365);
  res.json({ days, summary: watchSummary(req.user!.id, days) });
});

/* ------------------------------------------------------------- history */

router.get('/history', requireAuth, (req, res) => {
  const limit = Number(req.query.limit) || 50;
  const offset = Number(req.query.offset) || 0;
  const { entries, total } = listHistory(req.user!.id, {
    limit,
    offset,
    from: typeof req.query.from === 'string' ? req.query.from : undefined,
    to: typeof req.query.to === 'string' ? req.query.to : undefined,
    category: typeof req.query.category === 'string' ? req.query.category : undefined,
  });
  res.json({ entries, total, limit, offset });
});

/* ------------------------------------------------------------ guidelines */

router.get('/parameters', (_req, res) => {
  res.json({ parameters: listParameters() });
});

router.post('/parameters/import', requireAuth, (req, res) => {
  const list = req.body?.parameters;
  if (!Array.isArray(list) || list.length === 0) {
    res.status(400).json({ error: 'Send { parameters: [...] }.' });
    return;
  }
  const valid: RefParameter[] = [];
  for (const p of list) {
    if (!p?.parameterId || !p?.domain || !p?.name) continue;
    const bands = p.bands
      ? {
          greenMin: Number(p.bands.greenMin),
          greenMax: Number(p.bands.greenMax),
          yellowMin: Number(p.bands.yellowMin),
          yellowMax: Number(p.bands.yellowMax),
          redBelow: Number(p.bands.redBelow),
          redAbove: Number(p.bands.redAbove),
        }
      : null;
    valid.push({
      parameterId: String(p.parameterId),
      domain: String(p.domain),
      domainLabel: String(p.domainLabel ?? p.domain),
      name: String(p.name),
      whatToTrack: String(p.whatToTrack ?? ''),
      targetText: String(p.targetText ?? ''),
      thresholdBasis: String(p.thresholdBasis ?? ''),
      monitoringSource: String(p.monitoringSource ?? ''),
      cadence: String(p.cadence ?? 'daily'),
      relatedRisks: String(p.relatedRisks ?? ''),
      countermeasures: String(p.countermeasures ?? ''),
      consequence: String(p.consequence ?? ''),
      operationalImpact: String(p.operationalImpact ?? ''),
      notes: String(p.notes ?? ''),
      dateRetrieved: String(p.dateRetrieved ?? new Date().toISOString().slice(0, 10)),
      status: (['monitored', 'standard', 'trend', 'report'] as const).includes(p.status)
        ? p.status
        : 'trend',
      metricKey: p.metricKey ? String(p.metricKey) : null,
      aggregation: p.aggregation ? String(p.aggregation) : null,
      bandLabel: p.bandLabel ? String(p.bandLabel) : null,
      unit: p.unit ? String(p.unit) : null,
      bands,
    });
  }
  if (valid.length === 0) {
    res.status(422).json({ error: 'No valid parameters in payload.' });
    return;
  }
  const count = upsertParameters(valid);
  audit(req.user!.id, 'parameters.import', `${count} parameters`, clientIp(req));
  res.json({ imported: count });
});

router.get('/warnings', requireAuth, (req, res) => {
  const state = composeState(req.user!.id);
  if (!state) {
    res.status(404).json({ error: 'Crew profile not found.' });
    return;
  }
  res.json(evaluateWarnings(state.watchReadings, state.history));
});

/* --------------------------------------------------------------- misc */

router.get('/export', requireAuth, (req, res) => {
  const state = composeState(req.user!.id);
  res.setHeader('Content-Disposition', 'attachment; filename="vitanaut-export.json"');
  res.json({
    exportedAt: new Date().toISOString(),
    user: { crewId: req.user!.crewId },
    state,
    history: listHistory(req.user!.id, { limit: 500 }).entries,
    watchReadings: listWatchReadings(req.user!.id, { limit: 5000 }),
  });
});

router.get('/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});
