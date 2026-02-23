# Viringo API

Express API for the Viringo frontend: spawns, catch, collection, quests, beasts, seasons, leaderboard, and presence. The frontend lives in **VNX-Frontend/viringo** and calls this API (CORS is enabled).

## Install

```bash
npm install
```

## Environment

Copy `.env.example` to `.env` and set:

- **DATABASE_PATH** — Path to SQLite file (default: `data/creature-hunt.sqlite` in repo). On Railway use a persistent volume path, e.g. `/data/creature-hunt.sqlite`.
- **PORT** — Server port (default: `3001`).

## Run

- **Development** (with watch): `npm run dev`
- **Production**: `npm start`

Server listens on `http://localhost:PORT`. The frontend dev server proxies `/api` to this URL.

## Seed

To populate creatures, evolutions, quest definitions, and a sample season:

```bash
npm run seed
```

Run once after a fresh DB; safe to run again (uses `INSERT OR REPLACE` where needed).

## Production

Set `FRONTEND_ORIGIN` to your frontend URL (e.g. `https://your-app.vercel.app`) to restrict CORS. If unset, CORS allows all origins (`origin: true`).
