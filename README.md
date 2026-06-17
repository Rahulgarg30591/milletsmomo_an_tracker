# Millets Momo - Order Tracker

A Progressive Web App for daily order tracking at a momo cart. Built as a monorepo with React + MUI frontend and Express + Azure Functions backend backed by SQL Server.

---

## Prerequisites

Before you start, ensure you have:

| Tool | Version | Purpose |
|---|---|---|
| **Node.js** | ≥ 18 | Runtime for frontend and backend |
| **npm** | ≥ 9 | Package manager (comes with Node.js) |
| **Docker Desktop** | Latest | Runs local SQL Server container |

> **macOS users:** Docker Desktop is required. If you're on Apple Silicon (M1/M2/M3), the app uses `azure-sql-edge` which runs natively — no extra setup needed.

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
1. Starts a SQL Server container via Docker
2. Waits for the database to be ready
3. Creates the database if it doesn't exist
4. Runs the schema and seed scripts (24 menu items + 2 users)

> **First time only.** On subsequent runs, you can skip this if the container is already running. Check with `docker ps`.

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
| `npm run local:setup` | Start Docker SQL, create DB, run migrations |
| `npm run local:dev` | Start frontend + backend concurrently |
| `npm run local:stop` | Stop the Docker SQL container |
| `npm run local:db:migrate` | Re-run schema + seed (resets data) |
| `npm run local:db:seed` | Re-run seed only (updates PINs, menu) |
| `npm run local:build` | Build both frontend and backend for local |

### Testing & Quality

| Command | What it does |
|---|---|
| `npm test` | Run all tests across workspaces |
| `npm run typecheck` | TypeScript check all workspaces |
| `npm run lint` | ESLint all `.ts` and `.tsx` files |

### Production

| Command | What it does |
|---|---|
| `npm run prod:build` | Build for production |
| `npm run prod:setup` | Deploy Azure infrastructure (requires `az` CLI) |

---

## Troubleshooting

### `docker: command not found`

Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and ensure it's running before `npm run local:setup`.

### `SQL Server not available after 60 attempts`

The SQL container is still starting. Run:

```bash
npm run local:db:wait
```

Wait for it to say `SQL Server is ready.`, then run `npm run local:db:migrate`.

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
│       │   ├── db/          SQL pool, schema, seed
│       │   ├── middleware/  Auth, rate-limit, error handler
│       │   ├── routes/      Express routers
│       │   ├── services/    Business logic
│       │   └── validators/  Zod input validation
│       └── functions/       Azure Functions entry point
├── packages/
│   └── shared/            Menu data + pricing logic
└── docker-compose.yml     Local SQL Server container
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, MUI 6, Framer Motion, React Query |
| Backend | Node.js, Express, Azure Functions v4, TypeScript |
| Database | Azure SQL (cloud) / SQL Server Edge (local) |
| Auth | bcrypt PIN hashes + JWT |
| Deployment | Azure Static Web Apps + Azure Functions + Azure SQL |

---

## License

ISC
