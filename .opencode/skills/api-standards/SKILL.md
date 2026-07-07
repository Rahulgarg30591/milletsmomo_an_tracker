---
name: api-standards
description: REST API conventions for apps/backend (Express routes, status codes, error shape, auth, versioning, backward compatibility). Use when adding or modifying API endpoints, routes, controllers, validators, or response shapes. Covers REST consistency, request validation, response format, status codes, error responses, authentication, authorization, rate limiting, and documentation. Auto-load whenever an endpoint, route, or response shape is added or changed.
---

# API Standards

Authoritative REST API conventions for `apps/backend`. Code is the source of truth — `docs/API.md` is drifted (it says `Authorization: Bearer` but the code uses `x-auth-token`). Do not override explicit user instructions.

## Base path & mounting

- All API routes mount under `/api` in `src/app.ts` via `app.use('/api/<resource>', <routes>)`.
- Route files define the sub-path: `router.get('/', ...)` maps to `GET /api/<resource>`.
- One router file per resource: `authRoutes`, `menuRoutes`, `ordersRoutes`, `adminRoutes`, `supplyRoutes`, `clientLogRoutes`, `paymentSettlementRoutes`.
- `paymentSettlementRoutes` mounts at `/api/admin` (alongside `adminRoutes`) — settlement is admin-scoped.

## Authentication & authorization

- **Auth header**: `x-auth-token` (custom header), NOT `Authorization: Bearer`. Azure SWA injects its own `Authorization` header when proxying to managed functions, so the app uses a custom header to carry the user JWT. `docs/API.md` is wrong on this point — code wins.
- `authMiddleware` verifies the JWT on every `/api/*` route except `/api/auth/login` and `/api/health`. Apply it at the route level (`router.get('/', authMiddleware, controller)`), not globally.
- `requireRole('admin')` guards admin-only routes. Apply after `authMiddleware`:

```ts
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
router.post('/supply/order', authMiddleware, requireRole('admin'), createOrder);
```

- Access matrix (see `project-context` for full detail):
  - Public: `POST /api/auth/login`, `GET /api/health`, `POST /api/client-logs`.
  - Staff+: `/api/menu`, `/api/orders/*`, `/api/supply/verification`, `/api/supply/closing-stock`.
  - Admin: everything under `/api/admin/*` and `/api/settlement*`.

## HTTP methods

- `GET` — read. No request body. Filters via query params.
- `POST` — create a new resource. Returns `201`.
- `PUT` — full update/replace of an existing resource (`PUT /api/orders/:id` replaces the order).
- `PATCH` — partial state change (`PATCH /api/orders/:id/complete` changes only completion state + payment).
- `DELETE` — remove a resource. Returns `200` with `{ deleted: true, id }`.
- Do not use `POST` for updates when `PUT`/`PATCH` is semantically correct. The existing `PUT /api/admin/supply/order` is an upsert (semantically "replace the supply order for this date") — acceptable.

## URL conventions

- Plural resource nouns: `/api/orders`, `/api/menu`, `/api/admin/supply/orders`.
- Nested sub-resources for ownership: `/api/orders/:id/complete` (action on a specific order).
- Query params for filters: `?date=YYYY-MM-DD`, `?endDate=YYYY-MM-DD`, `?type=`, `?limit=`.
- Route params for IDs: `/:id`. IDs are numeric — validate in the controller (`Number(req.params.id)`, reject `NaN`/`0` with `400`).
- kebab-case for multi-word path segments: `/api/client-logs`, `/api/closing-stock`, `/api/staff-logs`.

## Request validation

- Every endpoint validates input with a Zod schema from `src/validators/` (see `backend-development` skill).
- Validate `req.body` for POST/PUT/PATCH, `req.query` for GET, `req.params` for route IDs.
- Date format: `/^\d{4}-\d{2}-\d{2}$/` (enforced by `dateQuerySchema`).
- Enums in Zod must match DB `CHECK` values exactly.
- On `ZodError`: return `400` with `{ error: '<human-readable message>' }`.

## Response format

- **Success**: the resource object or `{ <resource>: [...] }` / `{ date, orders: [...] }` directly — no envelope wrapper like `{ data: ... }` or `{ success: true }`. The existing convention returns bare resources/arrays.
- **Error**: `{ error: '<string>' }`. Single field, always a string, always human-readable. Never return stack traces, SQL text, or raw error objects.
- **Create (201)**: return the created resource object (see `ordersController.createOrder` → `res.status(201).json(result)`).
- **Delete (200)**: `{ deleted: true, id }`.
- **Complete (200)**: `{ id, completed: true }`.
- Do not add a `success: true` flag — the HTTP status code is the success signal.

## Status codes

| Code | When to use |
|---|---|
| `200` | Successful GET, successful PUT/PATCH/DELETE, successful POST that returns existing data |
| `201` | Resource created (POST) |
| `400` | Validation error (Zod), invalid ID, invalid state transition (e.g., complete an already-completed order) |
| `401` | Missing/invalid/expired token, missing `req.user` |
| `403` | Authenticated but wrong role (`requireRole` failure) |
| `404` | Resource not found (throw `Object.assign(new Error('...'), { status: 404 })`) |
| `429` | Rate limited (handled by `express-rate-limit`) |
| `500` | Unexpected server error (errorHandler masks message in production) |

- Throw errors with `status` from services; the `errorHandler` middleware formats the response. Controllers return `400` for Zod errors directly (they don't go through `next`).
- Never return `200` for an error. Never return `500` for a client error (400/404/403).

## Rate limiting

- `loginLimiter`: 5 requests / 15 min / IP on `POST /api/auth/login`.
- `globalLimiter`: 200 requests / min / IP on all other routes, skips `/api/health`.
- Applied in `app.ts` (`globalLimiter`) and `authRoutes` (`loginLimiter`). Do not add new limiters unless a specific endpoint is abuse-prone.
- Rate-limit responses use the standard `{ error: '...' }` shape (configured in `rateLimiter.ts`).

## Versioning

- No URL versioning currently (`/api/v1/`). The API is internal (single PWA client) and versioned via coordinated FE+BE deploys.
- **Do not introduce `/api/v2/`** unless a genuinely breaking change is needed and the FE is updated simultaneously.
- For backward-compatible additions (new fields, new endpoints), no version bump is needed.

## Backward compatibility

- **Adding fields to a response**: safe — the FE ignores unknown fields. No coordination needed.
- **Removing/renaming a field from a response**: BREAKING — update the FE in the same release. If the FE is deployed first, it breaks.
- **Changing a field type** (e.g., `string` → `number`): BREAKING — same release coordination required.
- **Adding a required field to a request**: BREAKING for existing clients. Make it optional with a safe default, or update the FE first.
- **Changing a status code or error message**: low-risk but coordinate — the FE may branch on specific messages (check `api/client.ts` 401 handling).
- **Adding a new endpoint**: safe.
- **Changing an existing endpoint's path/method**: BREAKING — avoid; add a new endpoint instead and deprecate the old.

When making a breaking change, deploy BE and FE together (the CI workflow builds both in one job, so a merged `main` deploy is atomic).

## Documentation

- When adding/changing an endpoint, update `docs/API.md` with the path, method, auth requirement, request body, query params, and response shape. **Use `x-auth-token` as the auth header** (fix the existing `Authorization: Bearer` references when you touch them).
- The `project-context` skill maintains the authoritative endpoint list — update it there too if the endpoint set changes.
- Example request/response blocks in `docs/API.md` should match actual Zod schemas and service return shapes.

## Health check

- `GET /api/health` is public (no auth) and checks DB connectivity: `SELECT 1`. Returns `{ status: 'ok', db: 'connected' }` (200) or `{ status: 'error', db: 'disconnected' }` (503). Do not add auth to it — it is used for liveness probes.

## Cross-cutting rules

- Defer to the `project-context` skill for the full endpoint catalog and role matrix.
- Defer to code over drifted docs (especially `docs/API.md` re: auth header).
- Never change the auth header from `x-auth-token` — it is coupled to the Azure SWA proxy architecture.
- Apply new conventions to new/edited endpoints; do not mass-refactor existing endpoints unless there is a concrete bug.
- `npm run typecheck` and `npm run lint` MUST pass before committing endpoint changes.
