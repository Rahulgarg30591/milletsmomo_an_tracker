---
name: backend-development
description: Backend engineering standards for apps/backend (Express + Azure Functions v4 + mssql + Zod). Use when creating or editing files under apps/backend/src — controllers, services, routes, validators, middleware, utils, db, constants. Covers layered architecture, separation of concerns, service layer, controllers, API design, error handling, validation, logging, configuration, naming, async, transactions, pagination/filtering/sorting, and code organization. Auto-load whenever a backend .ts file is touched.
---

# Backend Development Standards

Authoritative engineering standards for `apps/backend`. Code is the source of truth — these rules encode the existing architecture and promote incremental improvement. Do not override explicit user instructions.

## Architecture & layering

Four-layer structure, strictly one-directional. Dependencies flow downward only.

```
routes  →  controllers  →  services  →  db/pool
            ↑ validators      ↑ utils, constants
            ↑ middleware
```

- **Routes** (`src/routes/*Routes.ts`): Express `Router()` only. Map HTTP method + path → controller function. Apply `authMiddleware` (and `requireRole('admin')` for admin routes). No business logic, no validation, no DB access.
- **Controllers** (`src/controllers/*Controller.ts`): HTTP boundary. Parse/validate input (Zod), extract `req.user`/`req.params`, call one or more services, shape the HTTP response (status + JSON), delegate unexpected errors to `next(err)`. No direct DB access.
- **Services** (`src/services/*Service.ts`): Business logic **and** data access. This repo does NOT use a separate repository layer — services own SQL via `getPool()`. Keep SQL co-located with the logic that uses it. Services must be framework-agnostic: no `Request`/`Response` types, no `res.json`, no HTTP status codes returned via Express. Throw `Error` objects with a `status` property instead.
- **DB** (`src/db/pool.ts`): Singleton connection pool. Import `getPool` (and `closePool` for teardown) — never instantiate `sql.ConnectionPool` elsewhere.
- **Utils** (`src/utils/*.ts`): Pure, stateless helpers (pricing, date, time). No DB, no Express.
- **Constants** (`src/constants/*.ts`): Immutable in-memory data (menu). Built once at module load.
- **Middleware** (`src/middleware/*.ts`): Cross-cutting concerns (auth, rate-limit, error handler).
- **Validators** (`src/validators/*Validators.ts`): Zod schemas only. Exported, reused by controllers.

## ESM import rules

This workspace is `"type": "module"` with `moduleResolution: "bundler"`. **All relative imports MUST use the `.js` extension** even though source files are `.ts` — the compiled output is `.js` and Node resolves at runtime.

```ts
// CORRECT
import { getPool } from '../db/pool.js';
import * as ordersService from '../services/ordersService.js';

// WRONG — will fail at runtime in ESM
import { getPool } from '../db/pool';
```

Use `import * as <name>` namespace imports for services (matches existing controllers). Use named imports for types and utilities.

## Controller conventions

- Each controller function signature: `(req: Request, res: Response, next: NextFunction) => Promise<void>`.
- Always `return` after sending a response (`res.json(...)` / `res.status(...).json(...)`) — never fall through.
- Validate with Zod **first**, before any service call. Use `.parse()` for required input (throws `ZodError`) or `.safeParse()` when you need partial/optional handling (see `ordersController.completeOrder`).
- Catch `ZodError` by `err.name === 'ZodError'` and return `400` with a human-readable `{ error }` message. Delegate all other errors to `next(err)`.
- Extract `req.user?.id` for `createdBy` tracking; return `401` if missing on mutating endpoints.
- Keep controllers thin. If logic spans more than ~40 lines or mixes concerns, move it to a service.

### Controller pattern (follow this exactly)

```ts
export async function createThing(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = createThingSchema.parse(req.body);
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const result = await thingService.createThing(userId, data);
    res.status(201).json(result);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }
    next(err);
  }
}
```

## Service conventions

- Export named async functions. No classes, no singletons-as-classes — function modules are the pattern.
- Services own the SQL. Acquire a request via `pool.request()` or `transaction.request()`.
- Throw errors with an HTTP-appropriate `status` property using `Object.assign`:

```ts
throw Object.assign(new Error('Order not found'), { status: 404 });
throw Object.assign(new Error('Cannot edit a completed order'), { status: 400 });
```

- Map DB rows from snake_case columns to camelCase fields **at the service boundary** — controllers and clients never see raw column names.
- Return plain objects/arrays matching the shared types. Do not return `sql.IResult` or raw recordsets.
- For operations touching multiple tables or multiple rows that must be atomic, wrap in a transaction (see Transactions below).
- Services must not import Express types (`Request`, `Response`). They receive already-parsed primitives.

## Validation

- Every endpoint validates input with a Zod schema in `src/validators/`.
- One file per resource domain: `orderValidators.ts`, `supplyValidators.ts`, etc.
- Validate `req.body` (POST/PUT/PATCH), `req.query` (GET filters), and `req.params` (route IDs) where applicable.
- Reuse schemas: `createOrderSchema` and `updateOrderSchema` share an `items` array definition.
- Date strings: validate with `/^\d{4}-\d{2}-\d{2}$/` regex (see `dateRegex`).
- Enums: use `z.enum([...])` matching the DB `CHECK` constraint values exactly (`'cash'|'upi'|'split'|'pending'`, `'dine'|'pack'`, etc.).
- Money: `z.number().min(0)`. Quantities: `z.number().int().positive()`.

## Error handling

- **Error shape**: `{ error: string }`. Always a single `error` field with a human-readable message.
- **Status codes**: see the `api-standards` skill for the full table. Common: `200` success, `201` created, `400` bad request / validation, `401` unauthenticated, `403` forbidden (role mismatch), `404` not found, `429` rate limited, `500` unexpected.
- The centralized `errorHandler` middleware reads `err.status` (default `500`) and, in production, masks `500` messages as `'Internal server error'`.
- Do not `console.error` in controllers/services — the error handler logs stacks in non-production.
- Never swallow errors silently. If you catch to perform cleanup, re-throw or call `next(err)`.

## Logging

- **HTTP request logging**: `morgan` with format `:method :url :status :res[content-length] - :response-time ms`. No bodies, no headers, no auth tokens in logs.
- **Staff operation logging**: write to `StaffOperationLogs` via `staffLogService.createLog(orderDate, operationType, userId, details)` for `order_create`, `order_update`, `verification`, `closing_stock`. Do this in the controller after the service call succeeds, not inside the service.
- **Supply order logs**: written inside `supplyService.createSupplyOrder` as part of the transaction (action `CREATE`/`UPDATE`).
- Do not add new logging libraries. Use `morgan` for HTTP, `staffLogService` for business ops, `console.error` only in the error handler.

## Configuration management

- Env loading: `db/pool.ts` `loadEnvConfig()` reads `.env.development` / `.env.production`, then `loadLocalSettings()` reads `local.settings.json` (dev only). Never read env files ad hoc in services.
- Required env vars: `SQL_SERVER`, `SQL_DATABASE`, `SQL_USER`, `SQL_PASSWORD`, `SQL_PORT`, `JWT_SECRET`, `ALLOWED_ORIGINS`.
- Never commit secrets. `local.settings.json` and `.env.*` are gitignored. Document new keys in `local.settings.example.json`.
- Access env via `process.env.KEY` with a safe default only for non-sensitive values (`NODE_ENV`, `SQL_PORT`). `JWT_SECRET` MUST be set in production — an empty secret is a critical security failure.

## Dependency injection

This codebase uses **module-level singletons**, not a DI container. Do not introduce one.

- `getPool()` returns the singleton `ConnectionPool`.
- `buildMenu()` runs once at module load in `constants/menu.ts`; services import the memoized result.
- To make a service testable, export functions and import the real dependencies at module top. For tests, mock at the module boundary (e.g., mock `../db/pool.js` and `../constants/menu.js`) rather than injecting constructors.

## Naming conventions

- **Files**: `<resource>Routes.ts`, `<resource>Controller.ts`, `<resource>Service.ts`, `<resource>Validators.ts`, `<name>Middleware.ts`, `<name>.ts` (utils/constants).
- **Functions**: `camelCase` for functions and variables (`getOrders`, `createOrder`).
- **Types/Interfaces**: `PascalCase` (`OrderItem`, `SupplyVerification`).
- **Zod schemas**: `<purpose>Schema` (`createOrderSchema`, `dateQuerySchema`).
- **Constants**: `UPPER_SNAKE_CASE` (`FILLINGS`, `FULL_PRICES`).
- **DB columns**: `snake_case` (schema). **TS fields**: `camelCase`. Map at the service boundary.

## Async programming

- All I/O (DB, bcrypt) is `async`. Always `await` — never fire-and-forget.
- Use `Promise.all` for independent queries (e.g., fetching prices and names in parallel). Do NOT use `Promise.all` for sequential-dependent queries or for transactional writes.
- In `catch` blocks that need cleanup (transactions), `await transaction.rollback()` then re-throw.
- Avoid top-level `await` in modules other than `db/pool.ts` env loading (which is synchronous via `fs`).

## Transactions

Use for any operation that writes to multiple tables or multiple rows and requires atomicity (create order + items, update order + re-insert items, supply order + items + log).

```ts
const transaction = pool.transaction();
await transaction.begin();
try {
  const req = transaction.request();
  req.input('id', sql.BigInt, id);
  // ... more inputs
  await req.query(`INSERT INTO ... VALUES (@id, ...)`);

  for (const item of data.items) {
    const itemReq = transaction.request();
    // ... inputs per item
    await itemReq.query(`INSERT INTO ... VALUES (...)`);
  }

  await transaction.commit();
} catch (err) {
  await transaction.rollback();
  throw err;
}
```

- Every `request` inside a transaction MUST be `transaction.request()` — never `pool.request()`.
- Create a **new request per query** (inputs are bound to a single request; reusing causes conflicts).
- Always commit at the end of the `try` and rollback in `catch`.

## Pagination, filtering, sorting

The current API uses date-range filtering (`?date=&endDate=`) without pagination — the dataset is small (daily orders for one cart). For future endpoints that may grow:

- **Pagination**: `?page=1&limit=20` with `OFFSET / FETCH NEXT` (SQL Server syntax). Validate with Zod (`z.number().int().positive().default(1)`). Return `{ items, total, page, limit }`.
- **Filtering**: validate every filter param with Zod. Use parameterized inputs. Keep WHERE clauses sargable (see `database` skill).
- **Sorting**: `?sortBy=created_at&order=desc`. Whitelist sortable columns in the validator (never pass raw user input into `ORDER BY`).
- Do not retrofit pagination onto existing endpoints unless the dataset actually grows — avoid speculative complexity.

## Code organization

- One resource per file across all layers. Do not mix orders logic into supply services.
- Group by feature, not by technical type, within each layer directory (already the case).
- Keep files under ~300 lines. If a service grows beyond that, consider splitting read and write operations into `<resource>Service.ts` and `<resource>WriteService.ts` — but only when it genuinely improves clarity.
- Co-locate a service's interfaces with the service (e.g., `SupplyOrder` interface in `supplyService.ts`). Shared/cross-boundary types go in `packages/shared/src/types.ts`.

## Cross-cutting rules

- Defer to the `project-context` skill for business/domain facts (menu, pricing, stock, roles).
- Defer to code over drifted docs (`docs/ARCHITECTURE.md` says 4 tables; there are 13).
- Never modify the DB schema to satisfy a standard.
- Never introduce breaking architectural changes (no DI container, no ORM, no class-based services).
- Encode the current pattern as the baseline; mark improvements as "prefer X for new code."
- Never rewrite working code solely to satisfy a skill — apply standards to new and edited code incrementally.
