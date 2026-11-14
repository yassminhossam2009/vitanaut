# Vitanaut

**Live app:** [vitanaut.vercel.app](https://vitanaut.vercel.app)

Vitanaut is an astronaut health companion for long-duration space missions. It combines daily habit check-ins, private health history, wearable measurements, an AI flight-health assistant, and an adaptive digital garden that reflects the crew member's well-being.

The app is a full-stack React + Express project. Accounts, history and wearable readings are stored in SQLite; the production site runs on Vercel with a serverless Express function.

## Features

- **Crew accounts** — private astronaut profiles with scrypt-hashed passwords and signed sessions.
- **Daily check-ins** — exercise, sleep, nutrition, hydration and mental-health habits.
- **Private history** — every completed habit, mood change and note is scoped to the signed-in astronaut.
- **Wearable telemetry** — heart rate, HRV, SpO₂, stress, sleep, bone load and active minutes.
- **Health warnings** — live checks against the guideline catalog, with plain-language consequences and immediate actions.
- **Urgent alert popup** — a red out-of-range reading immediately opens a focused alert with “Do this right now” guidance.
- **Digital garden** — stones, flowers, birds and trees grow from different health domains.
- **Mission themes** — ISS, Lunar, Mars and Deep Space each have their own dark, low-contrast background photography.
- **Flight Health Assistant** — provider chain with a built-in guidance fallback, so the Assistant still responds without an API key.

## Quick start

Requirements: **Node.js 22** and npm.

```bash
npm ci
npm run dev
```

Open **http://localhost:3000**. The database is created and seeded on first boot.

### Demo accounts

| Astronaut ID | Password | Starting mission |
|---|---|---|
| `AST-042` | `orbit2026` | ISS Orbit |
| `CDR-017` | `artemis` | Lunar Base |

These accounts are for the demo only. Create new accounts and remove or rotate the demo credentials before real use.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4 |
| 3D garden | Three.js |
| Backend | Express 4 |
| Database | SQLite via `better-sqlite3` |
| Auth | scrypt password hashing, HMAC-signed session tokens |
| AI assistant | Dr7 MedGemma → Gemini → OpenAI-compatible provider → built-in guidance |
| Hosting | Vercel (`api/index.ts` + `vercel.json`) |

## Health rules

The catalog contains **42 parameters**:

- **41** come from the supplied NASA habit-domain guideline CSV.
- **1** is the app's screening rule for resting heart rate.

Five parameters have live numeric rules and are checked automatically:

| Metric | Data source | Rule | Healthy band |
|---|---|---|---|
| Resting heart rate | Wearable | Latest reading within 48 h | 50–100 bpm |
| Total sleep time | Wearable | Latest reading within 48 h | 7–9 h |
| Stress index | Wearable | Latest reading within 48 h | 0–40 |
| Exercise dose | Wearable | 7-day average | 90–240 min/day |
| Mood | Check-ins | 7-day average, at least 2 logs | 3.5–5 |

The heart-rate band is an **app screening default**, not a NASA numeric limit. The guideline file does not define a numeric heart-rate threshold. The UI labels this distinction under **“Why this matters and where the limit comes from.”**

Warnings are evaluated by the shared engine in `src/lib/healthWarnings.ts`, so the Home panel and Watch page update immediately from the current app data. The API exposes the same rules at `GET /api/warnings`.

The remaining parameters are stored as reference data with their target, monitoring source, consequences, operational impact and countermeasures. They become live when a matching data source is added.

### Changing the guideline baseline

Edit `database/source/habit-domain-parameters.csv`, then rebuild the catalog:

```bash
python3 scripts/build-reference-catalog.py
```

The generated file is `database/reference-parameters.json`. Parameters can also be imported through `POST /api/parameters/import`.

## Assistant

`POST /api/assistant` tries providers in this order:

1. Dr7 MedGemma (`DR7_API_KEY`)
2. Gemini (`GEMINI_API_KEY`)
3. Any OpenAI-compatible endpoint (`OPENAI_API_KEY`, optional `OPENAI_BASE_URL` / `OPENAI_MODEL`)
4. Built-in rule-based guidance

If no provider is configured or all providers fail, the Assistant still returns useful guidance and can add a tailored habit to the tracker.

## Project structure

```text
vitanaut/
├── api/
│   └── index.ts                 Vercel serverless entry
├── database/
│   ├── reference-parameters.json  Generated 42-parameter catalog
│   ├── README.md                Catalog workflow
│   └── source/
│       └── habit-domain-parameters.csv
├── docs/
│   ├── ARCHITECTURE.md          Backend, schema, security and API
│   ├── DEPLOYMENT.md            Vercel, Docker, Render, Fly.io
│   ├── README.md                Documentation index
│   └── USER_GUIDE.md            No-code guide to using the app
├── scripts/
│   └── build-reference-catalog.py
├── server/
│   ├── db.ts                    Schema, migrations and queries
│   ├── passwords.ts             scrypt hashing
│   ├── routes.ts                Authenticated REST API
│   ├── sessions.ts              Signed session tokens
│   └── warnings.ts              Server warning wrapper
├── src/
│   ├── assets/
│   │   ├── backgrounds/         Mission background photography
│   │   └── landscape-art/       Digital-garden artwork
│   ├── components/              Pages, navigation, alerts and modals
│   ├── data/                    Mission and NASA resource data
│   ├── lib/                     API client and shared warning engine
│   └── utils/
├── tests/
│   ├── api-smoke.mjs            End-to-end API test
│   └── warnings.test.ts         Warning threshold tests
├── server.ts                    Express entry and Assistant route
├── vercel.json                  Vercel build and function config
├── Dockerfile                   Production container
├── docker-compose.yml
├── render.yaml
├── fly.toml
├── start-windows.bat
├── start-mac.command
└── start-linux.sh
```

## Tests

Start the app first, then run the API smoke test:

```bash
npm run dev
npm run smoke
```

Run the warning threshold tests with a temporary database:

```bash
VITANAUT_DB_PATH=/tmp/vitanaut-test.db npx tsx tests/warnings.test.ts
```

Type-check the project:

```bash
npm run lint
```

## Environment variables

Copy `.env.example` to `.env` and fill only the providers you need.

| Variable | Purpose |
|---|---|
| `PORT` | Express port, default `3000` |
| `VITANAUT_DB_PATH` | SQLite file, default `data/vitanaut.db` |
| `VITANAUT_SESSION_SECRET` | Secret for signed sessions; set in production |
| `DR7_API_KEY` | Optional Dr7 MedGemma provider |
| `GEMINI_API_KEY` | Optional Gemini provider |
| `OPENAI_API_KEY` | Optional OpenAI-compatible provider |
| `OPENAI_BASE_URL` | Optional provider base URL |
| `OPENAI_MODEL` | Optional model name |

## Deployment

The production app is deployed on Vercel at **[vitanaut.vercel.app](https://vitanaut.vercel.app)**.

For a permanent deployment:

1. Import the repository into Vercel.
2. Add `VITANAUT_SESSION_SECRET` in **Project → Settings → Environment Variables**.
3. Add an Assistant provider key if you want an external LLM; otherwise the built-in fallback is used.
4. Redeploy.

Vercel's filesystem is ephemeral. Demo accounts reseed on each cold start, but user-created accounts and history can disappear when instances restart. For durable production data, connect a hosted Postgres/Neon database and replace the SQLite layer in `server/db.ts`.

Full instructions for Vercel, Docker, Render, Fly.io and a VPS are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Security and limitations

- Passwords are hashed with scrypt; plaintext passwords are never stored.
- Sessions are HMAC-signed tokens, verified without requiring a shared session table.
- Every history, wearable and state query is scoped to the authenticated user.
- Wearable values are range-validated before storage.
- This is a challenge prototype, not a medical device. Do not use it for clinical decisions.
- Health data is sensitive. Use HTTPS, restrict database access and rotate demo accounts before real use.

## Documentation

- [User guide](docs/USER_GUIDE.md) — no-code walkthrough of the live app.
- [Architecture](docs/ARCHITECTURE.md) — database, auth, API and warning engine.
- [Deployment](docs/DEPLOYMENT.md) — hosting and operational notes.
- [Database catalog](database/README.md) — guideline source and rebuild workflow.
