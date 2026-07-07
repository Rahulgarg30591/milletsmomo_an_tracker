---
name: database
description: Database standards for apps/backend (Azure SQL via mssql, singleton pool, parameterized queries, transactions). Use when editing files that contain SQL or DB access — apps/backend/src/db/**, apps/backend/src/services/** (any file importing getPool or sql), or schema.sql/seed.sql. Covers query efficiency, N+1 prevention, pagination, data access patterns, transaction handling, repository usage, query readability, connection management, performance, safe migrations, and data consistency. Auto-load whenever SQL or mssql is touched. Schema is frozen — never modify it.
---

# Database Standards

Authoritative standards for all data access in `apps/backend`. **The schema (`apps/backend/src/db/schema.sql`) is frozen — do not modify it.** These rules govern how services query the existing 13 tables. Code is the source of truth. Do not override explicit user instructions.

## Schema reference (frozen, 13 tables)

`Users`, `MenuItems`, `Orders` (BIGINT epoch-ms PK), `OrderItems` (CASCADE), `SupplyItems`, `DailySupplyOrders` (UQ date), `DailySupplyOrderItems` (CASCADE), `SupplyOrderLogs`, `SupplyVerifications` (UQ date+item), `DailyClosingStock` (UQ date+item, `pieces_left` 0..23), `StaffOperationLogs`, `ClientActivityLogs`, `DailyPaymentSettlements` (UQ date).

See the `project-context` skill for full column details, fillings, supply items, and stock computation rules. `docs/ARCHITECTURE.md` is drifted (says 4 tables) — ignore it.

## Parameterized queries — mandatory

**ALL queries MUST use `request.input()` parameterized placeholders.** String interpolation of user data into SQL is forbidden and is the #1 security rule in this repo.

```ts
// CORRECT
const request = pool.request();
request.input('orderDate', sql.Date, date);
const rows = await request.query(
  'SELECT * FROM Orders WHERE order_date = @orderDate',
);

// FORBIDDEN — SQL injection
const rows = await pool.request().query(
  `SELECT * FROM Orders WHERE order_date = '${date}'`,
);
```

- Bind every value that originates from user input, query params, or request bodies.
- Use the correct `sql.<Type>` constant matching the column type: `sql.Int`, `sql.BigInt`, `sql.NVarChar`, `sql.NVarChar(n)`, `sql.Date`, `sql.Decimal(p, s)`, `sql.Bit`.
- `BIGINT` for `Orders.id` (epoch-ms). `Decimal(8,2)` for money. `Bit` for booleans (pass `1`/`0` or `true`/`false`).

## Dynamic `IN (...)` lists

When building an `IN` clause with a variable-length list (see `supplyService.createSupplyOrder`), use indexed parameter placeholders — never interpolate the values:

```ts
const ids = items.map((i) => i.supplyItemId);
const req = pool.request();
ids.forEach((id, idx) => req.input(`id${idx}`, sql.Int, id));
const result = await req.query(
  `SELECT id, unit_price FROM SupplyItems WHERE id IN (${ids.map((_, idx) => `@id${idx}`).join(', ')})`,
);
```

Only the placeholder names (`@id0`, `@id1`, ...) are interpolated — these are safe (controlled identifiers), not user values.

## Connection management (singleton pool)

- Import `getPool` from `../db/pool.js`. Never call `sql.connect()` or instantiate `ConnectionPool` outside `pool.ts`.
- `getPool()` lazily connects, handles concurrent-connect races, and returns the singleton. Call it at the top of each service function — it is cheap when already connected.
- Pool config: `max: 10, min: 0, idleTimeoutMillis: 30000, connectTimeout: 5000`. Do not change without reason.
- `closePool()` is for teardown only (tests, graceful shutdown). Do not call it in request handlers.
- Always `await` `getPool()` — it is async.

## N+1 query prevention

The existing code has one known N+1: `supplyService.listSupplyOrders` loops over orders and issues a separate items query per order. For new code, avoid this pattern.

**Patterns to use:**

1. **Single query with JOIN + in-memory grouping** (preferred for parent-child, see `ordersService.getOrders`):
   ```ts
   const rows = await request.query(
     `SELECT o.*, i.* FROM Orders o
      LEFT JOIN OrderItems i ON i.order_id = o.id
      WHERE o.order_date = @orderDate
      ORDER BY o.id DESC, i.id`,
   );
   const orderMap = new Map<number, Order>();
   for (const row of rows.recordset) {
     let order = orderMap.get(row.id);
     if (!order) { order = { /* ... */ items: [] }; orderMap.set(row.id, order); }
     if (row.menu_item_id !== null) order.items.push({ /* ... */ });
   }
   return [...orderMap.values()];
   ```

2. **Batch fetch** (when a JOIN is impractical): fetch all parent IDs, then one `IN (...)` query for all children, then stitch.

3. **`Promise.all` for independent queries**: when fetching two unrelated aggregates (e.g., orders + supply order for the same date), run them in parallel:
   ```ts
   const [ordersRes, supplyRes] = await Promise.all([
     pool.request().query(/* ... */),
     pool.request().query(/* ... */),
   ]);
   ```
   Each `pool.request()` call gets its own request — safe to parallelize.

## Transaction handling

Use a transaction for any operation that writes to multiple tables or multiple rows and must be atomic. Existing examples: `createOrder` (Orders + N OrderItems), `updateOrder` (UPDATE + DELETE items + re-INSERT), `createSupplyOrder` (order + items + log).

```ts
const transaction = pool.transaction();
await transaction.begin();
try {
  // every request here MUST be transaction.request(), not pool.request()
  const req = transaction.request();
  req.input('id', sql.BigInt, id);
  await req.query(`INSERT INTO Orders ... VALUES (@id, ...)`);

  for (const item of data.items) {
    const itemReq = transaction.request();  // new request per query
    // ... inputs
    await itemReq.query(`INSERT INTO OrderItems ... VALUES (...)`);
  }

  await transaction.commit();
} catch (err) {
  await transaction.rollback();
  throw err;  // re-throw so the controller/errorHandler can respond
}
```

**Rules:**
- Every request inside a transaction MUST be `transaction.request()`.
- Create a **new request per query** — inputs are bound to a single request and cannot be reused.
- Always `commit()` at the end of the `try` and `rollback()` in the `catch`.
- Do not put non-DB work (logging to StaffOperationLogs via a separate service call) inside the transaction unless it must be atomic with the write. The `createSupplyOrder` transaction includes the log write because supply logs must reflect exactly what was committed. The `createOrder` controller writes the staff log AFTER the service transaction commits — the log is best-effort, not atomic.

## Data access patterns (repository usage)

This codebase does NOT use a repository layer. Services own SQL directly. **Do not introduce a repository abstraction** — it would conflict with the existing architecture. Keep SQL co-located with the business logic in the service.

When a query is reused across services (e.g., fetching supply items), extract a shared service function and import it — do not duplicate the SQL.

## Query readability

- Use multi-line template literals with aligned columns and clear `SELECT`/`FROM`/`JOIN`/`WHERE`/`ORDER BY` sections (see `ordersService.getOrders`).
- Alias columns to camelCase in the SELECT when mapping to TS objects: `si.display_name AS displayName` is acceptable but the existing convention maps in TS (`displayName: row.display_name`). Match the existing per-service convention; do not mix within one file.
- Use table aliases consistently (`o` for Orders, `i` for OrderItems, `si` for SupplyItems, `doi` for DailySupplyOrderItems).
- Comment complex WHERE/JOIN logic only when the intent is non-obvious.

## Snake_case → camelCase mapping

Map at the service boundary, never expose raw column names to controllers or the API:

```ts
return result.recordset.map((row) => ({
  id: Number(row.id),              // BIGINT → number
  orderDate: formatDate(row.order_date),
  timeLabel: row.time_label,
  paymentMethod: row.payment_method,
  isCompleted: !!row.is_completed,  // BIT → boolean
  totalAmount: row.total_amount,
  // ...
}));
```

- `Number(row.id)` for `BIGINT` PKs to avoid string coercion.
- `!!row.is_bit_column` for `BIT` → boolean.
- `row.date_column` → `formatDate()` helper → `YYYY-MM-DD` string.
- `row.datetime_column.toISOString()` for timestamps.

## Money / decimal handling

- DB columns are `DECIMAL(p,s)`. `mssql` returns these as JS `number`.
- Tolerance for float comparison: use `|actual - expected| > 0.01` (see settlement conflict logic). Never `===` on money.
- Round with `Math.round` for display where the pricing logic requires it (see `computeHalfPrice`).

## Performance considerations

- **Sargable WHERE**: avoid wrapping indexed columns in functions. `WHERE order_date = @date` is sargable (uses `IX_Orders_OrderDate`); `WHERE CAST(order_date AS DATETIME) = ...` is not.
- **Indexed lookups**: existing indexes are `IX_Orders_OrderDate`, `IX_Orders_Completed`, `IX_OrderItems_OrderId`, `IX_DailySupplyOrderItems_OrderId`, `IX_SupplyOrderLogs_Date`, `IX_SupplyVerifications_Date`, `IX_DailyClosingStock_Date`, `IX_StaffOperationLogs_*`, `IX_ClientActivityLogs_*`, `IX_DailyPaymentSettlements_Date`. Query by these indexed columns when possible.
- **`SELECT` only what you need**: avoid `SELECT *` in new queries — enumerate columns. Existing `SELECT *`-style queries are acceptable but new ones should be explicit.
- **`ORDER BY` with index**: date-desc ordering aligns with the `*_Date` descending indexes.
- **Avoid correlated subqueries** for row-by-row lookups — use JOINs.

## Pagination (future guidance)

Current endpoints use date-range filtering without pagination (dataset is small — one cart's daily orders). If an endpoint grows:

- SQL Server: `OFFSET @skip ROWS FETCH NEXT @take ROWS ONLY`.
- Validate `page`/`limit` with Zod; compute `skip = (page - 1) * limit`.
- Return `{ items, total, page, limit }`.
- Do not retrofit pagination onto existing endpoints unless the dataset genuinely grows.

## Safe migrations (future development)

**The schema is frozen.** For future additive changes only:

- **Additive only**: new tables, new nullable columns, new indexes, new `CHECK` constraints that don't reject existing rows. These are non-breaking.
- **Never rename** an existing table or column (breaks all services). Add a new column, migrate data, switch queries, then drop the old — in separate releases.
- **Never drop** a column or table in the same release that removes its usage — do it in a later release after confirming no code references it.
- **Never change a column type** in-place (e.g., `INT` → `BIGINT`) — add a new column, backfill, switch, drop old.
- Migration scripts go in `apps/backend/src/db/` and run via `npm run local:db:migrate` / `npm run prod:db:migrate`. The current `schema.sql` is a drop-and-recreate script (acceptable for dev; production migrations must be additive `ALTER` scripts, not drops).
- Always test migrations locally against Docker SQL Edge before production.

## Data consistency

- **Foreign keys with CASCADE**: `OrderItems` → `Orders` (CASCADE delete), `DailySupplyOrderItems` → `DailySupplyOrders` (CASCADE). Deleting a parent row removes children automatically.
- **Unique constraints**: `UQ_DailySupplyOrders_Date`, `UQ_SupplyVerification_DateItem`, `UQ_DailyClosingStock_DateItem`, `UQ_DailyPaymentSettlement_Date`. Rely on these for upsert patterns — catch the duplicate-key error and handle (e.g., `updateSupplyOrder` deletes-then-recreates rather than upserting).
- **`updateSupplyOrder` pattern**: delete existing order + items + verifications for the date, then re-create via `createSupplyOrder` with action `UPDATE`. This is the established upsert strategy — replicate it for similar date-keyed single-row resources.
- **Server-side recomputation**: the backend recomputes all prices/totals from the canonical menu (`utils/pricing.ts`). Never trust client-supplied totals — see `security` skill.

## Cross-cutting rules

- Defer to the `project-context` skill for schema details, stock computation, and filling→packet mapping.
- Defer to code over drifted docs.
- **Never modify `schema.sql` or `seed.sql`** to satisfy a standard. Schema is frozen.
- Never introduce an ORM (Prisma, TypeORM, Sequelize) — `mssql` raw parameterized queries are the architecture.
- Never introduce a repository layer — services own data access.
- Apply query-efficiency improvements to new/edited queries; do not mass-rewrite working queries unless a perf issue is demonstrated.
