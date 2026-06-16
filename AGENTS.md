# AGENTS.md — milletsmomo_an_order

## State

Monorepo — `package.json` with `npm workspaces`: `apps/frontend`, `apps/backend`, `packages/shared`. CommonJS root, each workspace has its own `tsconfig.json` (strict mode). Target: a PWA order-tracking app for a momo shop, deployed on Azure Static Web Apps + Azure Functions + Azure SQL (Free tier). License: ISC.

## Commands

Run all from root unless noted.

| Command | What |
|---|---|
| `npm run dev` | Concurrently starts frontend Vite dev server + backend Functions host |
| `npm test` | Runs tests in all workspaces (`--workspaces --if-present`) |
| `npm run build` | Builds frontend (tsc + Vite) + backend (tsc) |
| `npm run lint` | ESLint across `.ts,.tsx` files |
| `npm run db:migrate` | Runs schema + seed SQL via `apps/backend/scripts/migrate.ts` |

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
2. **Theme** — MUI theme per PRD Section 6.
3. **Database** — schema.sql, seed.sql, pool.ts, migration scripts.
4. **Backend auth** — auth service, controller, routes, middleware, rate-limiter, Express app skeleton.
5. **Backend menu & orders** — menu + orders + admin controllers/services.
6. **Frontend auth** — AuthContext, axios client, LoginPage with PinPad, routing.
7. **Frontend Staff flow** — DateSelectPage, DayViewPage, NewOrderPage, OrderDraftContext.
8. **Payment flow** — PaymentModal for pending-payment completion.
9. **Admin dashboard** — summary cards, item breakdown table.
10. **PWA** — vite-plugin-pwa, manifest, icons, iOS meta tags.
11. **Polish** — animations, responsive QA, validation messages, toasts.
12. **Documentation** — README.md, docs/ARCHITECTURE.md, docs/API.md, docs/DEPLOYMENT.md.
13. **Deployment** — provision Azure resources, configure GitHub Actions, set env vars, run migrations.
