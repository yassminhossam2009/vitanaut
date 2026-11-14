/**
 * SQLite persistence for Vitanaut.
 *
 * Three concerns are kept in separate tables and never mixed:
 *   users / sessions / profiles   -> accounts and access
 *   habits / habit_logs / chat    -> each astronaut's private history
 *   watch_readings                -> wearable measurements
 *
 * Every read is scoped by user_id. The API layer never trusts a crewId from
 * the request body; it uses the id resolved from the session token.
 */

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  ChatMessage,
  CompletedLog,
  CrewAccountSummary,
  CrewState,
  GardenElement,
  HabitCategory,
  HabitTask,
  MissionId,
  WatchReading,
} from '../src/types.ts';
import { createSeedCrewState } from '../src/data/seedCrewState.ts';
import { hashPassword } from './passwords.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH =
  process.env.VITANAUT_DB_PATH ??
  (process.env.VERCEL ? '/tmp/vitanaut.db' : path.join(DATA_DIR, 'vitanaut.db'));
const LEGACY_STORE = path.join(DATA_DIR, 'crew_store.json');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialised. Call initDb() first.');
  return db;
}

export interface UserRow {
  id: string;
  crew_id: string;
  password_hash: string;
  role: string;
  created_at: string;
  last_login_at: string | null;
}

export interface PublicUser {
  id: string;
  crewId: string;
  role: string;
  createdAt: string;
}

const nowIso = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

function ensureDataDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function initDb(): void {
  ensureDataDir();
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      crew_id       TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'astronaut',
      created_at    TEXT NOT NULL,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

    CREATE TABLE IF NOT EXISTS revoked_sessions (
      token_hash TEXT PRIMARY KEY,
      revoked_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS profiles (
      user_id               TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      crew_name             TEXT NOT NULL,
      role_title            TEXT NOT NULL,
      mission_id            TEXT NOT NULL,
      mission_sol           INTEGER NOT NULL DEFAULT 1,
      avatar_url            TEXT,
      last_habit_reset_date TEXT,
      updated_at            TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS habits (
      id                  TEXT NOT NULL,
      user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title               TEXT NOT NULL,
      category            TEXT NOT NULL,
      garden_element      TEXT NOT NULL,
      equipment_or_protocol TEXT NOT NULL,
      scheduled_time      TEXT NOT NULL,
      duration_minutes    INTEGER NOT NULL,
      description         TEXT NOT NULL,
      mental_benefit      TEXT NOT NULL,
      nasa_reference      TEXT NOT NULL,
      completed_today     INTEGER NOT NULL DEFAULT 0,
      is_urgent           INTEGER NOT NULL DEFAULT 0,
      added_by_assistant  INTEGER NOT NULL DEFAULT 0,
      condition_note      TEXT,
      sort_order          INTEGER NOT NULL DEFAULT 0,
      created_at          TEXT NOT NULL,
      updated_at          TEXT NOT NULL,
      PRIMARY KEY (user_id, id)
    );
    CREATE INDEX IF NOT EXISTS idx_habits_user ON habits(user_id, sort_order);

    CREATE TABLE IF NOT EXISTS habit_logs (
      id               TEXT NOT NULL,
      user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      habit_id         TEXT NOT NULL,
      title            TEXT NOT NULL,
      category         TEXT NOT NULL,
      garden_element   TEXT NOT NULL,
      completed_at     TEXT NOT NULL,
      mission_id       TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      mood_before      INTEGER NOT NULL,
      mood_after       INTEGER NOT NULL,
      notes            TEXT,
      created_at       TEXT NOT NULL,
      PRIMARY KEY (user_id, id)
    );
    CREATE INDEX IF NOT EXISTS idx_logs_user_time ON habit_logs(user_id, completed_at DESC);

    CREATE TABLE IF NOT EXISTS watch_readings (
      id                 TEXT NOT NULL,
      user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      measured_at        TEXT NOT NULL,
      heart_rate_bpm     REAL,
      hrv_ms             REAL,
      spo2_percent       REAL,
      stress_index       REAL,
      sleep_hours        REAL,
      deep_sleep_percent REAL,
      bone_load_kn       REAL,
      active_minutes     REAL,
      source             TEXT NOT NULL,
      device_id          TEXT,
      received_at        TEXT NOT NULL,
      PRIMARY KEY (user_id, id)
    );
    CREATE INDEX IF NOT EXISTS idx_watch_user_time ON watch_readings(user_id, measured_at DESC);

    CREATE TABLE IF NOT EXISTS chat_messages (
      id          TEXT NOT NULL,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role        TEXT NOT NULL,
      text        TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      added_habit TEXT,
      is_error    INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, id)
    );
    CREATE INDEX IF NOT EXISTS idx_chat_user_time ON chat_messages(user_id, created_at);

    CREATE TABLE IF NOT EXISTS ref_parameters (
      parameter_id TEXT PRIMARY KEY,
      domain       TEXT NOT NULL,
      domain_label TEXT,
      name         TEXT NOT NULL,
      what_to_track TEXT,
      target_text  TEXT,
      threshold_basis TEXT,
      monitoring_source TEXT,
      cadence      TEXT NOT NULL,
      related_risks TEXT,
      countermeasures TEXT,
      consequence  TEXT,
      operational_impact TEXT,
      notes        TEXT,
      date_retrieved TEXT,
      status       TEXT NOT NULL DEFAULT 'trend',
      metric_key   TEXT,
      aggregation  TEXT,
      band_label   TEXT,
      unit         TEXT,
      direction    TEXT,
      source       TEXT,
      source_ref   TEXT,
      evidence_grade TEXT,
      green_min REAL, green_max REAL,
      yellow_min REAL, yellow_max REAL,
      red_below REAL, red_above REAL
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id   TEXT,
      action    TEXT NOT NULL,
      detail    TEXT,
      ip        TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_events(created_at DESC);
  `);

  migrateReferenceColumns();
  migrateLegacyStore();
  seedDemoAccounts();
  seedReferenceCatalog();
}

/* ------------------------------------------------------------------ auth */

export function createUser(crewId: string, passwordHash: string): UserRow {
  const row: UserRow = {
    id: uuid(),
    crew_id: crewId,
    password_hash: passwordHash,
    role: 'astronaut',
    created_at: nowIso(),
    last_login_at: null,
  };
  db.prepare(
    `INSERT INTO users (id, crew_id, password_hash, role, created_at, last_login_at)
     VALUES (@id, @crew_id, @password_hash, @role, @created_at, @last_login_at)`
  ).run(row);
  return row;
}

export function findUserByCrewId(crewId: string): UserRow | undefined {
  return db
    .prepare('SELECT * FROM users WHERE crew_id = ? COLLATE NOCASE')
    .get(crewId) as UserRow | undefined;
}

export function findUserById(id: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
}

export function touchLogin(userId: string): void {
  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(nowIso(), userId);
}

export function toPublicUser(u: UserRow): PublicUser {
  return { id: u.id, crewId: u.crew_id, role: u.role, createdAt: u.created_at };
}

/* --------------------------------------------------------------- profile */

export function getProfile(userId: string): CrewState | undefined {
  const p = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId) as
    | Record<string, any>
    | undefined;
  if (!p) return undefined;
  return composeState(userId);
}

export function listAccounts(): CrewAccountSummary[] {
  const rows = db
    .prepare(
      `SELECT u.crew_id, p.crew_name, p.role_title, p.mission_id, p.mission_sol, p.avatar_url
       FROM users u JOIN profiles p ON p.user_id = u.id
       ORDER BY u.created_at ASC`
    )
    .all() as Array<Record<string, any>>;
  return rows.map((r) => ({
    crewId: r.crew_id,
    crewName: r.crew_name,
    roleTitle: r.role_title,
    missionId: r.mission_id as MissionId,
    missionSol: r.mission_sol,
    avatarUrl: r.avatar_url ?? undefined,
  }));
}

export function composeState(userId: string, limitLogs = 500): CrewState | undefined {
  const profile = db
    .prepare('SELECT * FROM profiles WHERE user_id = ?')
    .get(userId) as Record<string, any> | undefined;
  if (!profile) return undefined;

  const habitRows = db
    .prepare('SELECT * FROM habits WHERE user_id = ? ORDER BY sort_order ASC, created_at DESC')
    .all(userId) as Array<Record<string, any>>;
  const logRows = db
    .prepare('SELECT * FROM habit_logs WHERE user_id = ? ORDER BY completed_at DESC LIMIT ?')
    .all(userId, limitLogs) as Array<Record<string, any>>;
  const watchRows = db
    .prepare('SELECT * FROM watch_readings WHERE user_id = ? ORDER BY measured_at ASC LIMIT 2000')
    .all(userId) as Array<Record<string, any>>;
  const chatRows = db
    .prepare('SELECT * FROM chat_messages WHERE user_id = ? ORDER BY created_at ASC LIMIT 500')
    .all(userId) as Array<Record<string, any>>;

  return {
    crewId: db.prepare('SELECT crew_id FROM users WHERE id = ?').pluck().get(userId) as string,
    crewName: profile.crew_name,
    roleTitle: profile.role_title,
    missionId: profile.mission_id as MissionId,
    missionSol: profile.mission_sol,
    lastHabitResetDate: profile.last_habit_reset_date ?? undefined,
    avatarUrl: profile.avatar_url ?? undefined,
    habits: habitRows.map(rowToHabit),
    history: logRows.map(rowToLog),
    watchReadings: watchRows.map(rowToWatch),
    chatMessages: chatRows.map(rowToChat),
  };
}

function rowToHabit(r: Record<string, any>): HabitTask {
  return {
    id: r.id,
    title: r.title,
    category: r.category as HabitCategory,
    gardenElement: r.garden_element as GardenElement,
    equipmentOrProtocol: r.equipment_or_protocol,
    scheduledTime: r.scheduled_time,
    durationMinutes: r.duration_minutes,
    description: r.description,
    mentalBenefit: r.mental_benefit,
    nasaReference: r.nasa_reference,
    completedToday: Boolean(r.completed_today),
    isUrgent: Boolean(r.is_urgent) || undefined,
    addedByAssistant: Boolean(r.added_by_assistant) || undefined,
    conditionNote: r.condition_note ?? undefined,
  };
}

function rowToLog(r: Record<string, any>): CompletedLog {
  return {
    id: r.id,
    habitId: r.habit_id,
    title: r.title,
    category: r.category as HabitCategory,
    gardenElement: r.garden_element as GardenElement,
    completedAt: r.completed_at,
    missionId: r.mission_id as MissionId,
    durationMinutes: r.duration_minutes,
    moodBefore: r.mood_before,
    moodAfter: r.mood_after,
    notes: r.notes ?? undefined,
  };
}

function rowToWatch(r: Record<string, any>): WatchReading {
  return {
    id: r.id,
    timestamp: r.measured_at,
    heartRateBpm: r.heart_rate_bpm,
    hrvMs: r.hrv_ms,
    spo2Percent: r.spo2_percent,
    stressIndex: r.stress_index,
    sleepHours: r.sleep_hours,
    deepSleepPercent: r.deep_sleep_percent,
    boneLoadKn: r.bone_load_kn,
    activeMinutes: r.active_minutes,
    source: r.source,
  };
}

function rowToChat(r: Record<string, any>): ChatMessage {
  return {
    id: r.id,
    role: r.role,
    text: r.text,
    timestamp: r.created_at,
    addedHabit: r.added_habit ? (JSON.parse(r.added_habit) as HabitTask) : undefined,
    error: r.is_error ? true : undefined,
  };
}

/* ---------------------------------------------------------- state write */

export function saveState(userId: string, state: CrewState): CrewState {
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO profiles (user_id, crew_name, role_title, mission_id, mission_sol, avatar_url, last_habit_reset_date, updated_at)
       VALUES (@user_id, @crew_name, @role_title, @mission_id, @mission_sol, @avatar_url, @last_habit_reset_date, @updated_at)
       ON CONFLICT(user_id) DO UPDATE SET
         crew_name = excluded.crew_name,
         role_title = excluded.role_title,
         mission_id = excluded.mission_id,
         mission_sol = excluded.mission_sol,
         avatar_url = excluded.avatar_url,
         last_habit_reset_date = excluded.last_habit_reset_date,
         updated_at = excluded.updated_at`
    ).run({
      user_id: userId,
      crew_name: state.crewName,
      role_title: state.roleTitle,
      mission_id: state.missionId,
      mission_sol: state.missionSol,
      avatar_url: state.avatarUrl ?? null,
      last_habit_reset_date: state.lastHabitResetDate ?? null,
      updated_at: nowIso(),
    });

    const upsertHabit = db.prepare(
      `INSERT INTO habits (id, user_id, title, category, garden_element, equipment_or_protocol,
        scheduled_time, duration_minutes, description, mental_benefit, nasa_reference,
        completed_today, is_urgent, added_by_assistant, condition_note, sort_order, created_at, updated_at)
       VALUES (@id, @user_id, @title, @category, @garden_element, @equipment_or_protocol,
        @scheduled_time, @duration_minutes, @description, @mental_benefit, @nasa_reference,
        @completed_today, @is_urgent, @added_by_assistant, @condition_note, @sort_order, @created_at, @updated_at)
       ON CONFLICT(user_id, id) DO UPDATE SET
         title = excluded.title,
         category = excluded.category,
         garden_element = excluded.garden_element,
         equipment_or_protocol = excluded.equipment_or_protocol,
         scheduled_time = excluded.scheduled_time,
         duration_minutes = excluded.duration_minutes,
         description = excluded.description,
         mental_benefit = excluded.mental_benefit,
         nasa_reference = excluded.nasa_reference,
         completed_today = excluded.completed_today,
         is_urgent = excluded.is_urgent,
         added_by_assistant = excluded.added_by_assistant,
         condition_note = excluded.condition_note,
         sort_order = excluded.sort_order,
         updated_at = excluded.updated_at`
    );

    state.habits.forEach((h, idx) => {
      upsertHabit.run({
        id: h.id,
        user_id: userId,
        title: h.title,
        category: h.category,
        garden_element: h.gardenElement,
        equipment_or_protocol: h.equipmentOrProtocol,
        scheduled_time: h.scheduledTime,
        duration_minutes: h.durationMinutes,
        description: h.description,
        mental_benefit: h.mentalBenefit,
        nasa_reference: h.nasaReference,
        completed_today: h.completedToday ? 1 : 0,
        is_urgent: h.isUrgent ? 1 : 0,
        added_by_assistant: h.addedByAssistant ? 1 : 0,
        condition_note: h.conditionNote ?? null,
        sort_order: idx,
        created_at: nowIso(),
        updated_at: nowIso(),
      });
    });

    // Remove habits that were deleted in the client.
    const keep = state.habits.map((h) => h.id);
    if (keep.length === 0) {
      db.prepare('DELETE FROM habits WHERE user_id = ?').run(userId);
    } else {
      db.prepare(
        `DELETE FROM habits WHERE user_id = ? AND id NOT IN (${keep.map(() => '?').join(',')})`
      ).run(userId, ...keep);
    }

    const insertLog = db.prepare(
      `INSERT OR IGNORE INTO habit_logs (id, user_id, habit_id, title, category, garden_element,
        completed_at, mission_id, duration_minutes, mood_before, mood_after, notes, created_at)
       VALUES (@id, @user_id, @habit_id, @title, @category, @garden_element, @completed_at,
        @mission_id, @duration_minutes, @mood_before, @mood_after, @notes, @created_at)`
    );
    for (const l of state.history) {
      insertLog.run({
        id: l.id,
        user_id: userId,
        habit_id: l.habitId,
        title: l.title,
        category: l.category,
        garden_element: l.gardenElement,
        completed_at: l.completedAt,
        mission_id: l.missionId,
        duration_minutes: l.durationMinutes,
        mood_before: l.moodBefore,
        mood_after: l.moodAfter,
        notes: l.notes ?? null,
        created_at: nowIso(),
      });
    }

    // Un-completing a habit removes the log client-side. Delete recent logs
    // that are no longer present, but keep older history intact.
    const logIds = state.history.map((l) => l.id);
    const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    if (logIds.length === 0) {
      db.prepare('DELETE FROM habit_logs WHERE user_id = ? AND completed_at >= ?').run(userId, cutoff);
    } else {
      db.prepare(
        `DELETE FROM habit_logs WHERE user_id = ? AND completed_at >= ?
         AND id NOT IN (${logIds.map(() => '?').join(',')})`
      ).run(userId, cutoff, ...logIds);
    }

    const insertChat = db.prepare(
      `INSERT OR IGNORE INTO chat_messages (id, user_id, role, text, created_at, added_habit, is_error)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const m of state.chatMessages) {
      insertChat.run(
        m.id,
        userId,
        m.role,
        m.text,
        m.timestamp,
        m.addedHabit ? JSON.stringify(m.addedHabit) : null,
        m.error ? 1 : 0
      );
    }

    // Watch readings are written through their own endpoint (and through
    // migration), never from a generic state PUT. This keeps the measurements
    // table append-only and prevents duplicated packets.
  });
  tx();
  return composeState(userId)!;
}

/* --------------------------------------------------------------- watch */

export interface WatchReadingInput extends WatchReading {
  deviceId?: string;
}

export function insertWatchReading(userId: string, r: WatchReadingInput): WatchReading {
  db.prepare(
    `INSERT INTO watch_readings (id, user_id, measured_at, heart_rate_bpm, hrv_ms, spo2_percent,
      stress_index, sleep_hours, deep_sleep_percent, bone_load_kn, active_minutes, source, device_id, received_at)
     VALUES (@id, @user_id, @measured_at, @hr, @hrv, @spo2, @stress, @sleep, @deep, @bone, @active, @source, @device, @received)
     ON CONFLICT(user_id, id) DO NOTHING`
  ).run({
    id: r.id,
    user_id: userId,
    measured_at: r.timestamp,
    hr: r.heartRateBpm,
    hrv: r.hrvMs,
    spo2: r.spo2Percent,
    stress: r.stressIndex,
    sleep: r.sleepHours,
    deep: r.deepSleepPercent,
    bone: r.boneLoadKn,
    active: r.activeMinutes,
    source: r.source,
    device: r.deviceId ?? null,
    received: nowIso(),
  });
  return r;
}

export function listWatchReadings(
  userId: string,
  opts: { limit?: number; from?: string; to?: string } = {}
): WatchReading[] {
  const limit = Math.min(Math.max(opts.limit ?? 500, 1), 5000);
  const rows = db
    .prepare(
      `SELECT * FROM watch_readings
       WHERE user_id = ?
         AND (? IS NULL OR measured_at >= ?)
         AND (? IS NULL OR measured_at <= ?)
       ORDER BY measured_at DESC LIMIT ?`
    )
    .all(userId, opts.from ?? null, opts.from ?? null, opts.to ?? null, opts.to ?? null, limit) as Array<Record<string, any>>;
  return rows.map(rowToWatch).reverse();
}

export function watchSummary(userId: string, days = 7) {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  return db
    .prepare(
      `SELECT COUNT(*) AS readings,
              AVG(heart_rate_bpm) AS avgHr, MIN(heart_rate_bpm) AS minHr, MAX(heart_rate_bpm) AS maxHr,
              AVG(hrv_ms) AS avgHrv, AVG(spo2_percent) AS avgSpo2,
              AVG(stress_index) AS avgStress, AVG(sleep_hours) AS avgSleep,
              AVG(active_minutes) AS avgActive
       FROM watch_readings WHERE user_id = ? AND measured_at >= ?`
    )
    .get(userId, since);
}

/* -------------------------------------------------------------- history */

export function listHistory(
  userId: string,
  opts: { limit?: number; offset?: number; from?: string; to?: string; category?: string } = {}
): { entries: CompletedLog[]; total: number } {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 500);
  const offset = Math.max(opts.offset ?? 0, 0);
  const where = ['user_id = ?'];
  const params: any[] = [userId];
  if (opts.from) {
    where.push('completed_at >= ?');
    params.push(opts.from);
  }
  if (opts.to) {
    where.push('completed_at <= ?');
    params.push(opts.to);
  }
  if (opts.category) {
    where.push('category = ?');
    params.push(opts.category);
  }
  const clause = where.join(' AND ');
  const total = db
    .prepare(`SELECT COUNT(*) FROM habit_logs WHERE ${clause}`)
    .pluck()
    .get(...params) as number;
  const rows = db
    .prepare(`SELECT * FROM habit_logs WHERE ${clause} ORDER BY completed_at DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as Array<Record<string, any>>;
  return { entries: rows.map(rowToLog), total };
}

/* --------------------------------------------------------------- ref data */

export type ParameterStatus = 'monitored' | 'standard' | 'trend' | 'report';

export interface ParameterBands {
  greenMin: number;
  greenMax: number;
  yellowMin: number;
  yellowMax: number;
  redBelow: number;
  redAbove: number;
}

export interface RefParameter {
  parameterId: string;
  domain: string;
  domainLabel: string;
  name: string;
  whatToTrack: string;
  targetText: string;
  thresholdBasis: string;
  monitoringSource: string;
  cadence: string;
  relatedRisks: string;
  countermeasures: string;
  consequence: string;
  operationalImpact: string;
  notes: string;
  dateRetrieved: string;
  status: ParameterStatus;
  metricKey: string | null;
  aggregation: string | null;
  bandLabel: string | null;
  unit: string | null;
  bands: ParameterBands | null;
}

export function listParameters(): RefParameter[] {
  const rows = db
    .prepare('SELECT * FROM ref_parameters ORDER BY domain, name')
    .all() as Array<Record<string, any>>;
  return rows.map((r) => ({
    parameterId: r.parameter_id,
    domain: r.domain,
    domainLabel: r.domain_label ?? r.domain,
    name: r.name,
    whatToTrack: r.what_to_track ?? '',
    targetText: r.target_text ?? '',
    thresholdBasis: r.threshold_basis ?? '',
    monitoringSource: r.monitoring_source ?? '',
    cadence: r.cadence,
    relatedRisks: r.related_risks ?? '',
    countermeasures: r.countermeasures ?? '',
    consequence: r.consequence ?? '',
    operationalImpact: r.operational_impact ?? '',
    notes: r.notes ?? '',
    dateRetrieved: r.date_retrieved ?? '',
    status: (r.status ?? 'trend') as ParameterStatus,
    metricKey: r.metric_key ?? null,
    aggregation: r.aggregation ?? null,
    bandLabel: r.band_label ?? null,
    unit: r.unit ?? null,
    bands:
      r.green_min === null && r.green_max === null
        ? null
        : {
            greenMin: r.green_min,
            greenMax: r.green_max,
            yellowMin: r.yellow_min,
            yellowMax: r.yellow_max,
            redBelow: r.red_below,
            redAbove: r.red_above,
          },
  }));
}

export function upsertParameters(params: RefParameter[]): number {
  const stmt = db.prepare(
    `INSERT INTO ref_parameters (parameter_id, domain, domain_label, name, what_to_track,
      target_text, threshold_basis, monitoring_source, cadence, related_risks, countermeasures,
      consequence, operational_impact, notes, date_retrieved, status, metric_key, aggregation,
      band_label, unit, direction, source, source_ref, evidence_grade,
      green_min, green_max, yellow_min, yellow_max, red_below, red_above)
     VALUES (@id, @domain, @domainLabel, @name, @whatToTrack, @targetText, @basis, @source,
      @cadence, @risks, @countermeasures, @consequence, @operationalImpact, @notes,
      @dateRetrieved, @status, @metricKey, @aggregation, @bandLabel, @unit,
      @direction, @source, @sourceRef, @evidenceGrade,
      @gMin, @gMax, @yMin, @yMax, @rLo, @rHi)
     ON CONFLICT(parameter_id) DO UPDATE SET
      domain=excluded.domain, domain_label=excluded.domain_label, name=excluded.name,
      what_to_track=excluded.what_to_track, target_text=excluded.target_text,
      threshold_basis=excluded.threshold_basis, monitoring_source=excluded.monitoring_source,
      cadence=excluded.cadence, related_risks=excluded.related_risks,
      countermeasures=excluded.countermeasures, consequence=excluded.consequence,
      operational_impact=excluded.operational_impact, notes=excluded.notes,
      date_retrieved=excluded.date_retrieved, status=excluded.status,
      metric_key=excluded.metric_key, aggregation=excluded.aggregation,
      band_label=excluded.band_label, unit=excluded.unit,
      green_min=excluded.green_min, green_max=excluded.green_max,
      yellow_min=excluded.yellow_min, yellow_max=excluded.yellow_max,
      red_below=excluded.red_below, red_above=excluded.red_above`
  );
  const tx = db.transaction((list: RefParameter[]) => {
    for (const p of list) {
      stmt.run({
        id: p.parameterId,
        domain: p.domain,
        domainLabel: p.domainLabel,
        name: p.name,
        whatToTrack: p.whatToTrack,
        targetText: p.targetText,
        basis: p.thresholdBasis,
        source: p.monitoringSource,
        cadence: p.cadence,
        risks: p.relatedRisks,
        countermeasures: p.countermeasures,
        consequence: p.consequence,
        operationalImpact: p.operationalImpact,
        notes: p.notes,
        dateRetrieved: p.dateRetrieved,
        status: p.status,
        metricKey: p.metricKey,
        aggregation: p.aggregation,
        bandLabel: p.bandLabel,
        unit: p.unit,
        direction: 'target_range',
        sourceRef: null,
        evidenceGrade: '—',
        gMin: p.bands?.greenMin ?? null,
        gMax: p.bands?.greenMax ?? null,
        yMin: p.bands?.yellowMin ?? null,
        yMax: p.bands?.yellowMax ?? null,
        rLo: p.bands?.redBelow ?? null,
        rHi: p.bands?.redAbove ?? null,
      });
    }
  });
  tx(params);
  return params.length;
}

const CATALOG_PATH = path.resolve(process.cwd(), 'database/reference-parameters.json');

export function seedReferenceCatalog(): number {
  if (!fs.existsSync(CATALOG_PATH)) {
    console.warn(`Reference catalog missing at ${CATALOG_PATH}; guideline alerts disabled.`);
    return 0;
  }
  const parsed = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8')) as {
    parameters: RefParameter[];
  };
  const count = upsertParameters(parsed.parameters);
  console.log(`Loaded ${count} reference parameters from ${path.basename(CATALOG_PATH)}`);
  return count;
}

/* ---------------------------------------------------------------- audit */

export function audit(userId: string | null, action: string, detail?: string, ip?: string): void {
  db.prepare(
    'INSERT INTO audit_events (user_id, action, detail, ip, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, action, detail ?? null, ip ?? null, nowIso());
}

/* ------------------------------------------------------------- migration */

function migrateReferenceColumns(): void {
  const existing = new Set(
    (db.prepare('PRAGMA table_info(ref_parameters)').all() as Array<{ name: string }>).map(
      (c) => c.name
    )
  );
  const columns: Array<[string, string]> = [
    ['domain_label', 'TEXT'],
    ['what_to_track', 'TEXT'],
    ['target_text', 'TEXT'],
    ['threshold_basis', 'TEXT'],
    ['monitoring_source', 'TEXT'],
    ['related_risks', 'TEXT'],
    ['countermeasures', 'TEXT'],
    ['consequence', 'TEXT'],
    ['operational_impact', 'TEXT'],
    ['notes', 'TEXT'],
    ['date_retrieved', 'TEXT'],
    ['status', "TEXT NOT NULL DEFAULT 'trend'"],
    ['metric_key', 'TEXT'],
    ['aggregation', 'TEXT'],
    ['band_label', 'TEXT'],
  ];
  for (const [name, type] of columns) {
    if (!existing.has(name)) {
      db.exec(`ALTER TABLE ref_parameters ADD COLUMN ${name} ${type}`);
    }
  }
}

function migrateLegacyStore(): void {
  if (!fs.existsSync(LEGACY_STORE)) return;
  const already = db.prepare('SELECT COUNT(*) FROM users').pluck().get() as number;
  if (already > 0) return;

  try {
    const legacy = JSON.parse(fs.readFileSync(LEGACY_STORE, 'utf-8')) as Record<
      string,
      { crewId: string; password: string; state: CrewState }
    >;
    const tx = db.transaction(() => {
      for (const rec of Object.values(legacy)) {
        // Legacy passwords were stored in plaintext. They are hashed here and
        // the plaintext copy is never written to the new database.
        const user = createUser(rec.crewId.toUpperCase(), hashPassword(rec.password));
        saveState(user.id, rec.state);
        for (const w of rec.state.watchReadings ?? []) insertWatchReading(user.id, w);
      }
    });
    tx();
    const backup = `${LEGACY_STORE}.migrated-${Date.now()}`;
    fs.renameSync(LEGACY_STORE, backup);
    console.log(`Migrated ${Object.keys(legacy).length} legacy accounts; old store moved to ${backup}`);
  } catch (err) {
    console.error('Legacy store migration failed, leaving file untouched:', err);
  }
}

function seedDemoAccounts(): void {
  const count = db.prepare('SELECT COUNT(*) FROM users').pluck().get() as number;
  if (count > 0) return;

  const seeds = [
    { id: 'AST-042', name: 'Dr. Maya Lin', mission: MissionId.ISS, password: 'orbit2026' },
    { id: 'CDR-017', name: 'Cmdr. Tariq Hassan', mission: MissionId.LUNAR, password: 'artemis' },
  ];
  const tx = db.transaction(() => {
    for (const s of seeds) {
      const user = createUser(s.id, hashPassword(s.password));
      const state = createSeedCrewState(s.id, s.name, s.mission);
      saveState(user.id, state);
      for (const w of state.watchReadings ?? []) insertWatchReading(user.id, w);
    }
  });
  tx();
  console.log('Seeded demo accounts: AST-042 and CDR-017 (change these passwords before any real use)');
}

export function closeDb(): void {
  db?.close();
}
