# Deploying Vitanaut

The app ships as a single Node process: Express serves the API and the built
React SPA from `dist/`. Data lives in one SQLite file, so the only requirement
is a persistent disk mounted where `VITANAUT_DB_PATH` points.

## Build and run without Docker

```bash
npm ci
npm run build          # builds dist/ and bundles server.js
NODE_ENV=production VITANAUT_DB_PATH=./data/vitanaut.db npm start
```

Open `http://localhost:3000`. The database is created and seeded on first boot,
including the 41-parameter guideline catalog.

## Docker

```bash
docker build -t vitanaut .
docker run -p 3000:3000 -v vitanaut-data:/app/data \
  -e DR7_API_KEY=... vitanaut
```

or

```bash
docker compose up -d --build
```

The named volume `vitanaut-data` holds the database. Without a volume the
database is lost when the container is recreated.

## Vercel

Vercel is supported through `api/index.ts` and `vercel.json`. The frontend is
served from `dist/`; Express runs as one serverless function behind `/api/*`.

1. Import the repository at https://vercel.com/new, or run `vercel` from the
   project folder.
2. Vercel reads `vercel.json`; keep the framework preset on Vite.
3. Add environment variables in **Project → Settings → Environment Variables**:
   `OPENAI_API_KEY` (enables the LLM assistant), optional `OPENAI_MODEL`, and
   optional `DR7_API_KEY` or `GEMINI_API_KEY` if you prefer those providers.
4. Redeploy after adding variables.

**Important:** Vercel's filesystem is read-only except `/tmp`, and `/tmp` is not
shared between instances. The app detects Vercel and seeds `/tmp/vitanaut.db`
on each cold start, so the demo accounts always work, but data created by users
can disappear when the function scales or restarts. For real persistence,
connect a hosted Postgres/Neon database and replace `server/db.ts`; the schema
and every query are already scoped by `user_id`.

## Render

`render.yaml` is included. It expects a paid instance because free instances do
not support persistent disks.

1. Push the repository to GitHub.
2. In Render: **New → Blueprint**, select the repo.
3. Render creates the service with a 1 GB disk at `/var/data` and sets
   `VITANAUT_DB_PATH=/var/data/vitanaut.db`.
4. Add `DR7_API_KEY` or `GEMINI_API_KEY` as secret environment variables if you
   want the assistant enabled.

## Fly.io

```bash
fly launch --no-deploy
fly volumes create vitanaut_data --size 1
fly secrets set DR7_API_KEY=...
fly deploy
```

`fly.toml` sets the internal port to 3000, forces HTTPS and mounts the volume at
`/data`.

## Railway / any VPS

- Build command: `npm ci && npm run build`
- Start command: `NODE_ENV=production node server.js`
- Attach a volume and set `VITANAUT_DB_PATH=/data/vitanaut.db`
- Expose port 3000

On a bare VPS with Docker, `docker compose up -d` behind Caddy or Nginx is the
shortest path. Terminate TLS at the proxy and keep `X-Forwarded-Proto` intact;
the server already trusts the first proxy hop so session cookies are marked
Secure in production.

## Environment variables

- `OPENAI_API_KEY` — enables the OpenAI-compatible assistant provider
- `OPENAI_BASE_URL` — optional, defaults to `https://api.openai.com/v1`
- `OPENAI_MODEL` — optional, defaults to `gpt-5-mini`
- `PORT` — listen port, default 3000
- `VITANAUT_DB_PATH` — SQLite file, default `data/vitanaut.db`
- `DR7_API_KEY` — MedGemma assistant provider
- `GEMINI_API_KEY` — fallback assistant provider
- `NODE_ENV=production` — serves `dist/` and marks cookies Secure

## Backups

The entire state is one SQLite database. Back it up with the volume snapshot
your host provides, or:

```bash
sqlite3 /app/data/vitanaut.db ".backup '/backup/vitanaut-$(date +%F).db'"
```

The database contains personal health data. Restrict access to the volume and
backups, and rotate the seeded demo accounts before real use.

## Health checks

`GET /api/health` returns `{ "ok": true }`. The Dockerfile uses it as its
container health check; point your host's health check at the same path.

## Scaling note

SQLite in WAL mode handles a crew-sized workload comfortably. If the platform
grows to many concurrent stations, move `server/db.ts` to PostgreSQL; the
queries are plain SQL and every table is already scoped by `user_id`.
