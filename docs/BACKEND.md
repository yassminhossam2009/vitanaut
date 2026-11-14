# Vitanaut backend

The app now stores everything in a real database instead of one JSON file. The
backend is Express plus SQLite (via `better-sqlite3`), with scrypt password
hashing and session tokens. It runs in the same process as the Vite dev server,
so `npm run dev` is still the only command you need.

## Data areas

The database lives at `data/vitanaut.db` (override with `VITANAUT_DB_PATH`).
It is split into four areas that are deliberately not mixed.

**Accounts** are the `users`, `sessions` and `profiles` tables. A user row holds
the Crew ID and a scrypt hash; the plaintext password is never stored. Sessions
are random 32-byte tokens; only their SHA-256 hash is written to the database,
so a database leak does not expose usable sessions.

**Private history** is `habit_logs` plus the current `habits` and
`chat_messages` tables. Every row carries `user_id`, and every query filters on
the user resolved from the session token. A Crew ID in the URL that does not
match the token returns 403, not 404, so a user cannot even probe whether
another profile exists.

**Wearable measurements** are the `watch_readings` table: heart rate, HRV,
SpO2, stress index, sleep hours, deep-sleep percentage, bone load, active
minutes, source and device ID. Readings are append-only and idempotent by
`(user_id, id)`, so a device can safely retry a sync.

**Reference guidelines** are the `ref_parameters` table. It is loaded from
`db/reference_parameters.json`, generated from
`db/source/habit_domain_parameters.csv`: 41 parameters with target text,
monitoring source, cadence, related risks, consequences, operational impact,
countermeasures and notes. Four of them carry numeric bands and a live metric
(`sleep_hours`, `stress_index`, `active_minutes`, `mood`); the rest are
reference-only until a data source is added.

`server/warnings.ts` evaluates the live metrics. Latest-value parameters ignore
readings older than 48 hours; exercise uses a 7-day average of active minutes;
mood uses the 7-day average of check-in scores and needs at least two logs. A
value outside the green band becomes a yellow alert, outside the red envelope a
red alert, and the alert carries the consequence and operational-impact text
from the source file.

A small `audit_events` table records logins, failed logins, watch ingest and
guideline imports.

## Security decisions

Passwords use scrypt with N=16384, r=8, p=1 and a 16-byte salt, compared with
`timingSafeEqual`. Login attempts are throttled to 8 per ten minutes per
IP/Crew ID pair. Session cookies are HttpOnly, SameSite=Lax, and Secure in
production. The API also accepts an `Authorization: Bearer` token, which is
what the browser client uses.

All wearable values are range-validated on ingest. A heart rate of 500 bpm is
rejected with 422 rather than stored. State payloads are validated against the
authenticated Crew ID before any write.

The old JSON store, if present, is migrated automatically on first start:
passwords are hashed, every account's state is written into the tables, and the
original file is renamed to `crew_store.json.migrated-<timestamp>` rather than
deleted.

## API

Authentication:
- `POST /api/auth/register` — `{crewId, password, crewName, missionId, avatarUrl?, clientDate?}` returns `{token, user, state, accounts}`
- `POST /api/auth/login` — `{crewId, password, clientDate?}` returns the same shape
- `POST /api/auth/logout` — revokes the current session
- `GET /api/auth/me` — current user and state
- `GET /api/crew/accounts` — public directory used by the sign-in picker

State:
- `GET /api/state/:crewId?date=YYYY-MM-DD` — the composed state for the signed-in user
- `PUT /api/state/:crewId` — `{state}` syncs profile, habits, history and chat into their tables

Wearables:
- `POST /api/watch/readings` — `{reading}` or `{readings:[...]}` (up to 500 per call)
- `GET /api/watch/readings?limit=&from=&to=`
- `GET /api/watch/summary?days=7` — averages and min/max for the period

History:
- `GET /api/history?limit=&offset=&from=&to=&category=` — paginated private history with a total count

Guidelines and warnings (reference data and warnings; no separate UI page):
- `GET /api/parameters` — the 41-parameter reference catalog
- `POST /api/parameters/import` — `{parameters:[...]}` upserts by `parameterId`
- `GET /api/warnings` — evaluated alerts for the signed-in user, with checked values

Other:
- `GET /api/export` — full JSON export of the signed-in user's data
- `GET /api/health`

## Adding your guideline data later

Each parameter looks like this. The bands follow the catalog format from the
Vitanaut data playbook: green interval, yellow shoulders, red tails.

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
  "bands": { "greenMin": 7, "greenMax": 9, "yellowMin": 6, "yellowMax": 10, "redBelow": 6, "redAbove": 10 }
}
```

Import with `POST /api/parameters/import`, then read back with
`GET /api/parameters`. When we wire scoring into the UI, the same rows will
drive the garden and the advisory cards.

## Tests

With the server running:

```bash
BASE_URL=http://localhost:3000 node scripts/smoke-api.mjs
```

The smoke test covers 21 cases: health, login, wrong password, auth on state,
cross-user access, state sync, valid and invalid wearable ingest, history,
guideline loading, warning evaluation, guideline import, registration,
duplicate Crew ID and logout invalidation.

`scripts/test-warnings.ts` covers 10 threshold cases (healthy, low sleep, high
stress, low exercise, low mood, single mood log, stale reading).

## Demo accounts

`AST-042` / `orbit2026` and `CDR-017` / `artemis` are seeded on an empty
database. They exist for the demo only and should be removed or rotated before
any real deployment.
