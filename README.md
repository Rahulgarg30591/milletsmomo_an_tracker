# Millets Momo - Order Tracker

A Progressive Web App for daily order tracking at a momo cart. Built as a monorepo with a React + MUI frontend and an Express + Azure Functions backend, backed by Postgres (Supabase in production, a Docker container locally).

---

## Prerequisites

Before you start, ensure you have:

| Tool | Version | Purpose |
|---|---|---|
| **Node.js** | ≥ 18 | Runtime for frontend and backend |
| **npm** | ≥ 9 | Package manager (comes with Node.js) |
| **Docker Desktop** | Latest | Runs the local Postgres container |

> **macOS users:** Docker Desktop is required. The `postgres:17-alpine` image runs natively on Apple Silicon — no extra setup needed.

Verify your setup:

```bash
node --version    # Should show v18.x or higher
npm --version     # Should show 9.x or higher
docker --version  # Should show Docker version
```

---

## Quick Start (Local Development)

Follow these steps exactly to run the app on your machine:

### Step 1: Install dependencies

```bash
npm install
```

This installs all packages for the root workspace, frontend, backend, and shared library.

### Step 2: Start the local database

```bash
npm run local:setup
```

This command:
1. Starts a Postgres container via Docker
2. Waits for it to accept connections
3. Runs the schema and seed scripts (30 menu items, 3 users, 8 supply items)

The database itself is created by the container on first start, so there is no separate create-database step.

> **First time only.** On subsequent runs, you can skip this if the container is already running. Check with `docker ps`.

> **Port 5432 already taken?** Another project's Postgres may already hold it. Start this one elsewhere and point the app at it:
> ```bash
> MOMO_DB_PORT=5433 docker compose up -d
> ```
> then set `DATABASE_URL` in `apps/backend/.env.development` to use port `5433`.

### Step 3: Start the development servers

In **one terminal**, run both frontend and backend:

```bash
npm run local:dev
```

This starts:
- **Frontend** → [http://localhost:5173](http://localhost:5173)
- **Backend** → [http://localhost:7071](http://localhost:7071)

The frontend proxies API calls to the backend automatically.

### Step 4: Log in

Open [http://localhost:5173](http://localhost:5173) in your browser.

| Role | PIN |
|---|---|
| **Staff** | `9865` |
| **Admin** | `1703` |

---

## Common Commands

### Development

| Command | What it does |
|---|---|
| `npm run local:setup` | Start Docker Postgres and run schema + seed |
| `npm run local:dev` | Start frontend + backend concurrently |
| `npm run local:stop` | Stop the Docker Postgres container |
| `npm run local:db:migrate` | Re-run schema + seed (**drops every table first**) |
| `npm run local:db:seed` | Re-run seed only (updates PINs, menu) |
| `npm run local:build` | Build both frontend and backend for local |

### Testing & Quality

| Command | What it does |
|---|---|
| `npm test` | Unit tests across workspaces. Needs nothing running |
| `npm run test:int` | Backend against a real Postgres. Needs the Docker database |
| `npm run test:e2e` | Browser tests against the built app. Needs the Docker database |
| `npm run test:e2e:ui` | The same, in Playwright's interactive runner |
| `npm run test:all` | All three, in order |
| `npm run typecheck` | TypeScript check all workspaces |
| `npm run lint` | ESLint all `.ts` and `.tsx` files |

The integration and browser tests each build their own database
(`millets_momo_test` and `millets_momo_e2e`) from `schema.sql` and `seed.sql`,
so they never touch your development data. If your Postgres is on a port other
than 5432, pass it through:

```bash
MOMO_DB_PORT=5433 npm run test:int
```

They are deliberately not wired into CI — they are for use during development.

### Production

| Command | What it does |
|---|---|
| `npm run prod:build` | Build for production |
| `npm run prod:setup` | Deploy Azure infrastructure (requires `az` CLI) |

---

## Troubleshooting

### `docker: command not found`

Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and ensure it's running before `npm run local:setup`.

### `Postgres not available after 60 attempts`

The container is still starting. Run:

```bash
npm run local:db:wait
```

Wait for it to say `Postgres is ready.`, then run `npm run local:db:migrate`.

### `The server does not support SSL connections`

`DATABASE_URL` is pointing at a server without TLS while the pool is asking for it. For a host other than `localhost`, add `?sslmode=disable` to the URL.

### Port already in use

If `5173` or `7071` is taken, the frontend will auto-pick another port (check terminal output). The backend will also try an alternative port.

### Database connection errors after restart

If Docker stopped (e.g., after reboot), start it again:

```bash
docker compose up -d
npm run local:db:migrate
npm run local:dev
```

### Want to change the PINs?

Edit `apps/backend/src/db/seed.sql` and replace the bcrypt hashes, then run:

```bash
npm run local:db:seed
```

Or generate a new hash:

```bash
npm run generate-pin-hash -- 1234
```

---

## Project Structure

```
├── apps/
│   ├── frontend/          React 18 + MUI + Vite + PWA
│   │   ├── src/
│   │   │   ├── api/       API client modules
│   │   │   ├── components/ UI components (PinPad, MenuGrid, etc.)
│   │   │   ├── context/    Auth + OrderDraft state
│   │   │   ├── pages/      Login, DateSelect, DayView, NewOrder, Admin
│   │   │   └── theme/      MUI theme + dark mode
│   │   └── vite.config.ts  PWA + dev proxy config
│   └── backend/           Express API on Azure Functions
│       ├── src/
│       │   ├── controllers/ Route handlers
│       │   ├── db/          Postgres pool, schema, seed
│       │   ├── middleware/  Auth, rate-limit, error handler
│       │   ├── routes/      Express routers
│       │   ├── services/    Business logic
│       │   └── validators/  Zod input validation
│       └── functions/       Azure Functions entry point
├── packages/
│   └── shared/            Menu data + pricing logic
└── docker-compose.yml     Local Postgres container
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, MUI 6, Framer Motion, React Query |
| Backend | Node.js, Express, Azure Functions v4, TypeScript |
| Database | Supabase Postgres (cloud) / Postgres 17 in Docker (local) |
| Auth | bcrypt PIN hashes + HMAC-SHA256 token |
| Deployment | Azure Static Web Apps + Azure Functions, database on Supabase |

---

## License

ISC
