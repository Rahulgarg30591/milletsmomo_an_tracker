# Millets Momo - Order Tracker

A Progressive Web App for daily order tracking at a momo cart. Built as a monorepo with a React + MUI frontend and an Express + Azure Functions backend backed by Azure SQL.

## Quick Start

```bash
# Install dependencies (all workspaces)
npm install

# Run frontend + backend concurrently
npm run dev

# Or run individually
npm run dev:frontend   # Vite dev server on :5173
npm run dev:backend    # Azure Functions host on :7071
```

The frontend proxies `/api/*` requests to the backend via Vite's dev server proxy (`vite.config.ts`).

## Prerequisites

- **Node.js** ≥ 18
- **Azure Functions Core Tools** v4 (`npm i -g azure-functions-core-tools@4`)
- **Azure SQL** database (or local SQL Server for development)
- **Azure Functions extension** for VS Code (optional, for debugging)

## Database Setup

1. Create an Azure SQL database (Free tier or higher).
2. Copy `apps/backend/local.settings.example.json` to `apps/backend/local.settings.json` and fill in your connection values.
3. Generate bcrypt hashes for your PINs:

```bash
npm run generate-pin-hash -- 1234
# Copy the output hash
```

4. Edit `apps/backend/src/db/seed.sql` and replace `<BCRYPT_HASH_OF_STAFF_PIN>` and `<BCRYPT_HASH_OF_ADMIN_PIN>` with the generated hashes.
5. Run the migration:

```bash
npm run db:migrate
```

This creates the schema and inserts seed data (24 menu items + 2 users).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start frontend + backend concurrently |
| `npm run dev:frontend` | Start Vite dev server (port 5173) |
| `npm run dev:backend` | Start Azure Functions host (port 7071) |
| `npm run build` | Build all workspaces |
| `npm run typecheck` | TypeScript check across all workspaces |
| `npm run test` | Run tests in all workspaces |
| `npm run lint` | Lint `.ts` and `.tsx` files |
| `npm run db:migrate` | Run schema + seed SQL |
| `npm run generate-pin-hash` | Generate bcrypt hash for a 4-digit PIN |

## Project Structure

```
├── apps/
│   ├── frontend/          React 18 + MUI 6 + Vite PWA
│   │   ├── src/
│   │   │   ├── api/       Axios client + API modules
│   │   │   ├── components/ UI components (MenuGrid, PinPad, etc.)
│   │   │   ├── context/    AuthContext, OrderDraftContext
│   │   │   ├── hooks/      useMenu, useOrders, useAdminSummary
│   │   │   ├── pages/      Route-level pages
│   │   │   ├── theme/      MUI theme + design tokens
│   │   │   ├── types/      Frontend type definitions
│   │   │   └── utils/      Pricing, date, formatting helpers
│   │   └── vite.config.ts  PWA + proxy config
│   └── backend/           Express on Azure Functions
│       ├── src/
│       │   ├── controllers/  Route handlers
│       │   ├── db/            pool.ts, schema.sql, seed.sql
│       │   ├── middleware/    auth, rate-limiter, error handler
│       │   ├── routes/        Express routers
│       │   ├── services/      Business logic
│       │   ├── utils/         Time helpers
│       │   └── validators/    Zod schemas
│       └── functions/         Azure Functions v4 entry point
├── packages/
│   └── shared/             Menu data + pricing formula
└── docs/
    ├── ARCHITECTURE.md
    ├── API.md
    └── DEPLOYMENT.md
```

## Default Credentials

After seeding, two users are available:

| Role | PIN |
|---|---|
| Staff | `9865` |
| Admin | `1703` |

**Change these before deploying to production.**

## License

ISC