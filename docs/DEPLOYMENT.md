# Deployment

The production app runs at **[vitanaut.vercel.app](https://vitanaut.vercel.app)**.

Vitanaut ships as one Node process: Express serves the API and the built React SPA from `dist/`. Data lives in one SQLite file. A persistent disk is required for durable data; Vercel's serverless filesystem is ephemeral.

## Build and run without Docker

```bash
npm ci
npm run build
NODE_ENV=production VITANAUT_DB_PATH=./data/vitanaut.db npm start
```

Open `http://localhost:3000`. The database is created and seeded on first boot, including the 42-parameter guideline catalog.

## Vercel

The repository is already configured for Vercel:

- `vercel.json` builds the SPA and includes `database/reference-parameters.json` in the function bundle.
- `api/index.ts` exports the Express app as a serverless function.
- `/api/*` is rewritten to that function.

### Deploy

1. Import the repository at [vercel.com/new](https://vercel.com/new).
2. Keep the framework preset on **Vite**.
3. In **Project → Settings → Environment Variables**, add:
   - `VITANAUT_SESSION_SECRET` — required for stable signed sessions in production.
   - Optional Assistant providers: `DR7_API_KEY`, `GEMINI_API_KEY` or `OPENAI_API_KEY`.
4. Redeploy.

Or from the project folder:

```bash
npx vercel --prod
```

### Persistence on Vercel

Vercel is read-only except `/tmp`, and `/tmp` is not shared between instances. The app detects Vercel and seeds `/tmp/vitanaut.db` on each cold start, so the demo accounts work, but user-created accounts and history can disappear when the function scales or restarts.

For real production data, connect a hosted Postgres/Neon database and replace the SQLite layer in `server/db.ts`. The schema and queries are already scoped by `user_id`, so the migration is localized to the data layer.

## Docker

```bash
docker build -t vitanaut .
docker run -p 3000:3000 -v vitanaut-data:/app/data \
  -e VITANAUT_SESSION_SECRET=change-me \
  vitanaut
```

Or:

```bash
docker compose up -d --build
```

The named volume `vitanaut-data` holds the database. Without a volume, the database is lost when the container is recreated.

## Render

`render.yaml` is included. It expects a paid instance because free instances do not support persistent disks.

1. Push the repository to GitHub.
2. In Render: **New → Blueprint**, select the repository.
3. Render creates the service with a 1 GB disk at `/var/data` and sets `VITANAUT_DB_PATH=/var/data/vitanaut.db`.
4. Add `VITANAUT_SESSION_SECRET` and any Assistant provider keys as secret environment variables.

## Fly.io

```bash
fly launch --no-deploy
fly volumes create vitanaut_data --size 1
fly secrets set VITANAUT_SESSION_SECRET=change-me
fly deploy
```

`fly.toml` sets the internal port to 3000, forces HTTPS and mounts the volume at `/data`.

## Railway or a VPS

- Build command: `npm ci && npm run build`
- Start command: `NODE_ENV=production node server.js`
- Attach a volume and set `VITANAUT_DB_PATH=/data/vitanaut.db`
- Expose port 3000

On a bare VPS with Docker, `docker compose up -d` behind Caddy or Nginx is the shortest path. Terminate TLS at the proxy and keep `X-Forwarded-Proto` intact; the server trusts the first proxy hop so session cookies are marked Secure in production.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `VITANAUT_SESSION_SECRET` | Production | Secret used to sign session tokens |
| `PORT` | No | Listen port, default `3000` |
| `VITANAUT_DB_PATH` | No | SQLite file, default `data/vitanaut.db` |
| `DR7_API_KEY` | No | Dr7 MedGemma Assistant provider |
| `GEMINI_API_KEY` | No | Gemini Assistant provider |
| `OPENAI_API_KEY` | No | OpenAI-compatible Assistant provider |
| `OPENAI_BASE_URL` | No | Optional provider base URL |
| `OPENAI_MODEL` | No | Optional model name |
| `NODE_ENV=production` | Production | Serves `dist/` and marks cookies Secure |

The Assistant works without provider keys by falling back to built-in guidance.

## Backups

The entire state is one SQLite database. Back it up with the volume snapshot your host provides, or:

```bash
sqlite3 /app/data/vitanaut.db ".backup '/backup/vitanaut-$(date +%F).db'"
```

The database contains personal health data. Restrict access to the volume and backups, and rotate the seeded demo accounts before real use.

## Health checks

`GET /api/health` returns:

```json
{ "ok": true }
```

The Dockerfile uses this endpoint as its container health check. Point the hosting provider's health check at the same path.

## Scaling note

SQLite in WAL mode handles a crew-sized workload comfortably. For many concurrent stations, move `server/db.ts` to PostgreSQL. The queries are plain SQL and every table is already scoped by `user_id`.
