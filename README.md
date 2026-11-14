# Vitanaut

New to the project? Start with [START_HERE.md](START_HERE.md) for a no-code setup guide, or open [START_HERE.pdf](START_HERE.pdf).

Astronaut habit, mental-health and biometric-watch platform with an adaptive
space garden and an AI flight-surgeon assistant. Originally built in Google AI
Studio, now running on a real backend with accounts, private history and
wearable measurements in SQLite.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. On an empty database two demo accounts are
seeded: `AST-042` / `orbit2026` and `CDR-017` / `artemis`.

The AI assistant works with `DR7_API_KEY` (MedGemma) or `GEMINI_API_KEY`
(fallback) in `.env`. Without either key the rest of the app works normally
and the assistant returns a clear configuration error.

## Stack

- React 19 + TypeScript + Vite + Tailwind 4
- Express server (`server.ts`) that also serves the SPA in production
- SQLite via `better-sqlite3`, stored at `data/vitanaut.db`
- scrypt password hashing and hashed session tokens, no plaintext credentials

## What the backend stores

Three separate areas, all scoped to the signed-in user:

- **Accounts**: `users`, `sessions`, `profiles` — Crew ID, scrypt hash, mission profile
- **Private history**: `habit_logs`, `habits`, `chat_messages` — every completion, mood shift and note
- **Wearable measurements**: `watch_readings` — HR, HRV, SpO2, stress, sleep, bone load, active minutes
- **Reference guidelines**: `ref_parameters` — the 41 NASA habit-domain parameters plus an app screening heart-rate parameter (42 total), with targets, consequences and countermeasures

Full details, security notes and the API reference are in
[docs/BACKEND.md](docs/BACKEND.md).

## Guideline baseline and warnings

The CSV you supplied is the baseline: all 41 source parameters are loaded, plus one app screening heart-rate parameter, into
`ref_parameters` with their target, monitoring source, consequences and
countermeasures. Four parameters have live
numeric bands and are checked automatically: sleep duration, stress, 7-day
exercise minutes and 7-day mood. Sleep and stress use the latest reading within
48 hours; exercise and mood use 7-day averages.

Warnings appear on Home and Watch with the exact consequence and
operational-impact text from the file, plus the recommended countermeasure and
the basis for the band. Bands that are app defaults are labelled as such; the
rest stay reference-only until a data source exists. The reference library is
backend data only; it is not a separate app page.

To change the baseline, edit `db/source/habit_domain_parameters.csv` and run
`python3 scripts/build_reference_catalog.py`, or import JSON through
`POST /api/parameters/import`.

## Tests

```bash
npm run dev            # in one terminal
npm run smoke          # in another (expects port 3000)
```

The smoke test exercises 21 cases across auth, privacy boundaries, state sync,
wearable ingest, history, guideline loading, warnings and session invalidation.
`scripts/test-warnings.ts` checks 10 threshold cases with a temporary database:

```bash
VITANAUT_DB_PATH=/tmp/vitanaut-test.db npx tsx scripts/test-warnings.ts
```

## Assistant providers

`POST /api/assistant` tries providers in order: Dr7 MedGemma (`DR7_API_KEY`),
Gemini (`GEMINI_API_KEY`), then any OpenAI-compatible endpoint
(`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`). If none is configured or
all fail, it returns a built-in rule-based guidance response and still adds a
tailored habit, so the Assistant never shows a configuration error.

## Deploy

`npm run build && npm start` runs the production bundle. Docker, Compose,
Vercel, Render and Fly.io files are included; see [DEPLOY.md](DEPLOY.md). On
Vercel, `vercel.json` and `api/index.ts` are already configured; add
`OPENAI_API_KEY` in the project settings to enable the LLM. Vercel's `/tmp`
database is ephemeral, so use hosted Postgres for durable accounts.

## Project layout

- `src/` — React app, components, types, API client (`src/lib/api.ts`)
- `server/db.ts` — schema, migrations, all queries
- `server/routes.ts` — REST API and authorization
- `server/passwords.ts`, `server/sessions.ts` — scrypt hashing and sessions
- `server.ts` — Express entry, assistant route, Vite middleware
- `docs/BACKEND.md` — backend documentation
- `scripts/smoke-api.mjs` — end-to-end API test
