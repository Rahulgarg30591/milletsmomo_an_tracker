# AGENTS.md — milletsmomo_an_order

## State

Monorepo — `package.json` with `npm workspaces`: `apps/frontend`, `apps/backend`, `packages/shared`. CommonJS root, each workspace has its own `tsconfig.json` (strict mode). Target: a PWA order-tracking app for a momo shop, deployed on Azure Static Web Apps + Azure Functions + Azure SQL (Free tier). License: ISC.

## Commands

Run all from root unless noted.

### Local (development)

| Command | What |
|---|---|
| `npm run local:setup` | Start Docker SQL, wait for ready, create DB, run schema + seed |
| `npm run local:db:wait` | Wait for local SQL Server to accept connections |
| `npm run local:db:create` | Create local database if not exists |
| `npm run local:db:migrate` | Run schema.sql + seed.sql on local DB |
| `npm run local:db:seed` | Re-run seed.sql only on local DB |
| `npm run local:dev` | Start Docker SQL, then FE (Vite) + BE (Azure Functions) concurrently |
| `npm run local:stop` | Stop Docker SQL container |
| `npm run local:build` | Build both FE + BE for local |
| `npm run local:build:fe` | Build frontend only for local |
| `npm run local:build:be` | Build backend only for local |

### Production

| Command | What |
|---|---|
| `npm run prod:setup` | Deploy all Azure infra via Bicep (full stack) |
| `npm run prod:db:migrate` | Run schema.sql + seed.sql on production DB |
| `npm run prod:db:seed` | Re-run seed.sql only on production DB |
| `npm run prod:deploy` | Deploy SQL infra only via Bicep |
| `npm run prod:build` | Build both FE + BE for production |
| `npm run prod:build:fe` | Build frontend only for production |
| `npm run prod:build:be` | Build backend only for production |

### General

| Command | What |
|---|---|
| `npm test` | Runs tests in all workspaces (`--workspaces --if-present`) |
| `npm run lint` | ESLint across `.ts,.tsx` files |
| `npm run typecheck` | TypeScript type-check all workspaces |
| `npm run generate-pin-hash` | Generate bcrypt hash for a 4-digit PIN |

Run in a single workspace: `npm run <cmd> --workspace=<workspace>`.

## Directories

- `apps/frontend/` — React 18 + MUI 6 + Vite + PWA. Entry: `src/main.tsx`.
- `apps/backend/` — Express app wrapped as Azure Functions (`functions/api.ts`). Entry: `src/app.ts`. Tests in `tests/`.
- `packages/shared/` — Menu data (`src/menu.ts`), pricing logic (`src/pricing.ts`). Workspace dependency for both FE and BE.

## Conventions

- **Database**: Azure SQL via `mssql`. ALL queries use `request.input()` parameterized placeholders — string interpolation into SQL is forbidden.
- **Auth**: PINs stored as bcrypt hashes (cost 10). Login returns JWT (12h expiry). `authMiddleware` verifies on every protected route; `requireRole('admin')` guards `/api/admin/*`.
- **Middleware stack**: `helmet()` → `cors()` → `express.json({limit:'50kb'})` → rate-limit on `/api/auth/login` (5/min) → request logging (no bodies/headers) → routes → `errorHandler`.
- **Validation**: Every endpoint validates input with zod schemas in `apps/backend/src/validators/`.
- **Testing**: Backend: Vitest + Supertest (≥80% statement coverage on `src/services` and `src/utils`). Frontend: Vitest + React Testing Library, API calls mocked with MSW.
- **PWA**: `vite-plugin-pwa` configured; Lighthouse ≥90; installable on iOS Safari and Android Chrome; app shell loads offline.
- **Security**: No secrets committed. `local.settings.json` gitignored; `local.settings.example.json` documents keys. `dangerouslySetInnerHTML` forbidden. CSP restricts to `'self'` + Azure SWA origin.
- **Code quality**: TypeScript strict mode. ESLint + Prettier at root. JSDoc/TSDoc on exported functions. No unused deps.

## Deployment

GitHub Actions (`.github/workflows/azure-deploy.yml`) uses `Azure/static-web-apps-deploy`:
- `app_location: "apps/frontend"`, `api_location: "apps/backend"`, `output_location: "dist"`
- PRs → staging; merge to `main` → production.
- Azure SQL Free offer tier must be explicitly selected in Portal (not default).

## Build order (from PRD)

1. ✅ **Monorepo scaffolding** — root workspaces, `.gitignore`, `.editorconfig`, ESLint/Prettier, empty Vite/Functions projects, `packages/shared` (24 menu items, pricing).
2. ✅ **Database** — schema.sql, seed.sql, pool.ts, migration scripts. PINs (admin: 1703, staff: 9865) verified on fresh system.
3. ✅ **Theme** — MUI theme per PRD Section 6.
4. ✅ **Backend auth** — auth service, controller, routes, middleware, rate-limiter, Express app skeleton.
5. ✅ **Backend menu & orders** — menu + orders + admin controllers/services.
6. ✅ **Frontend auth** — AuthContext, axios client, LoginPage with PinPad, routing.
7. ✅ **Frontend Staff flow** — DateSelectPage, DayViewPage, NewOrderPage, OrderDraftContext.
8. ✅ **Payment flow** — PaymentModal for pending-payment completion.
9. ✅ **Admin dashboard** — summary cards, item breakdown table.
10. ✅ **PWA** — vite-plugin-pwa, manifest, icons, iOS meta tags.
11. ✅ **Polish** — animations, responsive QA, validation messages, toasts.
12. ✅ **Documentation** — README.md, docs/ARCHITECTURE.md, docs/API.md, docs/DEPLOYMENT.md.
13. ✅ **Deployment** — provision Azure resources, configure GitHub Actions, set env vars, run migrations.

## graphify

This repo has a graphify knowledge graph at `graphify-out/` (gitignored; 957 nodes / 1867 edges / 75 communities as of 2026-07-21).

- **Before codebase questions**, consult `graphify-out/GRAPH_REPORT.md` for the map: communities, god nodes, surprising connections, knowledge gaps.
- **Before editing a file**, check its community in `graphify-out/graph.json` to understand related modules and cross-community bridges.
- **After code changes**, the pre-push hook (`.git/hooks/pre-push`) auto-refreshes the graph via `graphify update .` (AST only, no LLM, ~1-3s). Outputs: `graph.json`, `graph.html`, `GRAPH_REPORT.md`. Log at `graphify-out/hook.log`.
- **After doc/paper/image edits**, run `/graphify . --update` manually — the hook cannot refresh semantic content (no LLM in hook context). Uses host agent as LLM by default; set `GEMINI_API_KEY` for headless Gemini extraction.
- **Query the graph**: `/graphify query "<question>"` (BFS), `--dfs` for path tracing, `--budget N` to cap tokens.
- **Trace paths**: `/graphify path "A" "B"` for shortest path between concepts.
- **Explain a node**: `/graphify explain "X"` for plain-language explanation of a node and its neighbors.
- **Full rebuild**: `/graphify .` from scratch (use after major refactors or if graph feels stale).
