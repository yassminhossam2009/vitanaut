# Vitanaut — User Guide

This guide assumes no programming experience.

## Open the app

The app is already online:

**https://vitanaut.vercel.app**

Sign in with one of the demo astronauts:

| Astronaut ID | Password |
|---|---|
| `CDR-017` | `artemis` |
| `AST-042` | `orbit2026` |

You can also create your own account from the sign-in screen. Choose a name, an Astronaut ID, a password of at least four characters, and a starting mission.

## A five-minute tour

### Home

Home shows the signed-in astronaut, today's habit progress and the **Health limit warnings** panel.

- A **yellow** card means a value is slightly outside the healthy range.
- A **red** card means a value needs immediate attention.
- Open **Why this matters and where the limit comes from** to see the consequence, the operational impact and whether the band is a NASA guideline or an app screening default.

### Tasks

Tasks is the daily check-in. Complete exercise, sleep, nutrition, hydration and mental-health habits. Each completion updates the private history and the digital garden.

### Assistant

Describe a symptom, sleep problem or stressor. The Assistant can suggest an immediate action and add a tailored habit to your tracker. It works even without an external AI key by using built-in guidance.

### Watch

Watch shows wearable telemetry: heart rate, HRV, blood oxygen, stress, sleep, bone load and active minutes. Use **Insert Watch Reading** to record a measurement manually.

If a red measurement is entered — for example a resting heart rate of 200 bpm — an urgent popup appears immediately with:

- the measured value and healthy range,
- **Do this right now** guidance,
- a **Discuss with Assistant** button,
- an **I understand** button.

### History

History shows only the signed-in astronaut's own check-ins, mood changes and readings.

### Landscape

Landscape is the interactive garden. Stones represent muscle and bone health, flowers represent cardiovascular health, birds represent psychological well-being, and trees represent overall health and consistency.

## Change the mission location

Use the **Location** menu in the top bar, or the **Change location** button on Home. You can switch between:

- ISS Orbit
- Lunar Base
- Mars Outpost
- Deep Space

The choice changes the app's background photography, palette and mission context. It does not create a new account or sign you out.

## Create and switch accounts

1. On the sign-in screen, choose **Create Another Account**.
2. Enter a name, Astronaut ID and password.
3. Pick a starting mission.
4. Select **Create Account & Enter Home**.

Each astronaut has a private history, wearable data and garden. Use **Switch User** on Home to move between accounts.

## Run the app on your own computer

You only need to install Node.js once.

### 1. Install Node.js

Download the **LTS** version from [nodejs.org](https://nodejs.org) and run the installer with the default options.

### 2. Start the app

From the project folder, open a terminal and run:

```bash
npm ci
npm run dev
```

Then open **http://localhost:3000**.

The first start can take a few seconds while dependencies and the database are prepared.

### 3. Stop the app

Press **Ctrl+C** in the terminal, or close the terminal window.

### One-click starters

The project also includes:

- `start-windows.bat`
- `start-mac.command`
- `start-linux.sh`

These install dependencies on first use and open the local app.

## Put it online

The production app runs on Vercel. To deploy your own copy:

1. Create a free account at [vercel.com](https://vercel.com).
2. Import the GitHub repository.
3. Keep the framework preset on **Vite**.
4. Add `VITANAUT_SESSION_SECRET` under **Settings → Environment Variables**.
5. Add an Assistant provider key only if you want an external LLM.
6. Redeploy.

Full technical instructions, including Docker, Render and Fly.io, are in [DEPLOYMENT.md](DEPLOYMENT.md).

**Important:** Vercel's serverless filesystem is temporary. The demo accounts reseed automatically, but accounts and history created by users may disappear when the app restarts. For a permanent database, connect hosted Postgres/Neon.

## Troubleshooting

| Problem | What to do |
|---|---|
| The page looks blank | Wait a few seconds and refresh. |
| The live site shows an old version | Refresh with **Ctrl+Shift+R** (Windows) or **Cmd+Shift+R** (Mac). |
| “Node.js is not installed” | Install the LTS version from nodejs.org, restart the computer and try again. |
| “Port 3000 is already in use” | Close the other terminal running Vitanaut, or restart the computer. |
| The Assistant says it is using built-in guidance | No external AI key is configured. The rest of the app still works. |
| A warning does not change | Open **Watch** and insert a new reading, or complete a check-in. Warnings use the latest data. |
| I forgot the demo password | Use `artemis` for `CDR-017` or `orbit2026` for `AST-042`. |
| I want to reset local data | Stop the app, delete the `data` folder and start again. The demo database is recreated. |

## Important limitations

- This is a challenge prototype, not a medical device. Do not use it for clinical decisions.
- The heart-rate band is an app screening default, not a NASA numeric limit.
- Other app-default bands are labelled in the UI and should be reviewed with a flight surgeon before operational use.
- The demo passwords are public. Remove or rotate the demo accounts before a real deployment.
- Health data is sensitive. Use HTTPS, restrict access to the database and do not share backups.
