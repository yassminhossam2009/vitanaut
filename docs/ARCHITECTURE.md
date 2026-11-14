# Architecture

Vitanaut is a single React application backed by an Express API and SQLite. In development, Express and Vite run together. In production, Vercel serves the built SPA and runs Express as a serverless function behind `/api/*`.

## Runtime layout

```text
Browser
  ├── React SPA (src/)
  ├── shared warning engine (src/lib/healthWarnings.ts)
  └── fetch → /api/*
                │
                ├── Express app (server.ts, server/routes.ts)
                ├── SQLite (data/vitanaut.db by default)
                └── Assistant providers (Dr7 → Gemini → OpenAI-compatible → local)
```

The frontend evaluates the five live health metrics locally so warnings react immediately to a new reading. The API exposes the same rules through the shared engine for integrations and server-side checks.

## Data model

The database lives at `data/vitanaut.db` and can be overridden with `VITANAUT_DB_PATH`.

### Accounts

`users`, `sessions` and `profiles` hold the Crew ID, scrypt password hash, role, mission profile and avatar. Plaintext passwords are never stored.

Sessions are **HMAC-signed tokens** containing the user id, Crew ID, role and expiry. Every serverless instance can verify a token without a shared session table. A best-effort row is also written to `sessions` for auditing. Logout records the token hash in `revoked_sessions`, so the token is rejected on instances that share the audit database.

### Private history

`habit_logs`, `habits` and `chat_messages` store completed habits, mood changes, notes and Assistant conversations. Every row carries `user_id`, and every query filters on the user resolved from the token. A Crew ID that does not match the token returns `403`, not `404`.

### Wearable measurements

`watch_readings` stores heart rate, HRV, SpO₂, stress index, sleep hours, deep-sleep percentage, bone load, active minutes, source and device ID. Readings are append-only and idempotent by `(user_id, id)`, so a device can safely retry a sync.

### Reference guidelines

`ref_parameters` is loaded from `database/reference-parameters.json`, generated from `database/source/habit-domain-parameters.csv`.

The catalog contains 42 entries:

- 41 source parameters with target text, monitoring source, cadence, related risks, consequences, operational impact, countermeasures and notes.
- 1 app screening rule for resting heart rate.

Five parameters have numeric bands and a live metric:

| Parameter | Metric | Aggregation |
|---|---|---|
| Resting heart rate | `heart_rate` | latest reading |
| Total sleep time | `sleep_hours` | latest reading |
| Stress | `stress_index` | latest reading |
| Exercise dose | `active_minutes` | 7-day average |
| Mood | `mood` | 7-day check-in average |

Latest-value parameters ignore readings older than 48 hours. Exercise uses a 7-day average of active minutes. Mood needs at least two check-ins in the last 7 days.

A value outside the green band becomes a yellow alert; outside the red envelope it becomes a red alert. The alert carries the consequence, operational impact and countermeasure from the source file.

The heart-rate band is an app screening default, not a NASA numeric limit. The `bandLabel` field states this explicitly and is shown in the UI.

### Audit log

`audit_events` records logins, failed logins, wearable ingest, guideline imports and other sensitive operations.

## Security

- Passwords use scrypt with `N=16384`, `r=8`, `p=1` and a 16-byte salt, compared with `timingSafeEqual`.
- Login attempts are throttled per IP/Crew ID pair.
- Session cookies are HttpOnly, SameSite=Lax and Secure in production. The browser client also supports an `Authorization: Bearer` token.
- Wearable values are range-validated before storage. A heart rate of 500 bpm is rejected with `422`.
- State payloads are validated against the authenticated Crew ID before any write.
- Every private query is scoped by `user_id`.

## API

### Authentication

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/auth/register` | Create an account; returns token, user, state and accounts |
| `POST` | `/api/auth/login` | Sign in; returns the same shape |
| `POST` | `/api/auth/logout` | Revoke the current session |
| `GET` | `/api/auth/me` | Current user and state |
| `GET` | `/api/crew/accounts` | Public directory used by the sign-in picker |

### State and history

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/state/:crewId?date=YYYY-MM-DD` | Composed state for the signed-in user |
| `PUT` | `/api/state/:crewId` | Sync profile, habits, history and chat |
| `GET` | `/api/history?limit=&offset=&from=&to=&category=` | Paginated private history |
| `GET` | `/api/export` | Full JSON export of the signed-in user's data |

### Wearables

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/watch/readings` | Insert one reading or a batch (up to 500) |
| `GET` | `/api/watch/readings?limit=&from=&to=` | Reading history |
| `GET` | `/api/watch/summary?days=7` | Averages and min/max |

### Guidelines and warnings

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/parameters` | 42-parameter reference catalog |
| `POST` | `/api/parameters/import` | Upsert parameters by `parameterId` |
| `GET` | `/api/warnings` | Evaluated alerts and checked values |

### Other

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Health check |

## Catalog format

Each parameter follows this shape:

```json
{
  "parameterId": "sleep_duration_h",
  "domain": "sleep",
  "name": "Sleep duration per 24 h",
  "unit": "h",
  "direction": "higher_better",
  "cadence": "daily",
  "source": "NASA OCHMO-TB-041",
  "sourceRef": "TB-041",
  "evidenceGrade": "A",
  "bands": {
    "greenMin": 7,
    "greenMax": 9,
    "yellowMin": 6,
    "yellowMax": 10,
    "redBelow": 6,
    "redAbove": 10
  }
}
```

Import through `POST /api/parameters/import`, then read back with `GET /api/parameters`.

## Frontend structure

| Path | Responsibility |
|---|---|
| `src/App.tsx` | App shell, auth state, mission theme, page routing, urgent alert |
| `src/components/HomePage.tsx` | Crew summary, habit progress, health warnings |
| `src/components/TasksPage.tsx` | Daily check-ins and personal metrics |
| `src/components/AssistantPage.tsx` | Assistant conversation and condition prompts |
| `src/components/WatchPage.tsx` | Wearable telemetry and reading entry |
| `src/components/HistoryPage.tsx` | Private history and charts |
| `src/components/LandscapePage.tsx` | Three.js digital garden |
| `src/components/HealthAlerts.tsx` | Warning panel with plain-language guidance |
| `src/components/UrgentAlertModal.tsx` | Immediate red-alert popup |
| `src/lib/healthWarnings.ts` | Shared warning engine and plain-language copy |
| `src/lib/api.ts` | Authenticated API client |

## Tests

With the server running:

```bash
npm run smoke
```

The API smoke test covers health, login, wrong password, auth boundaries, state sync, wearable ingest, history, guideline loading, warnings, registration, duplicate Crew ID and logout.

Warning thresholds:

```bash
VITANAUT_DB_PATH=/tmp/vitanaut-test.db npx tsx tests/warnings.test.ts
```

## Demo accounts

`AST-042` / `orbit2026` and `CDR-017` / `artemis` are seeded on an empty database. They are for the demo only and should be removed or rotated before any real deployment.
