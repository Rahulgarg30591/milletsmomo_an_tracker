---
name: performance
description: Performance best practices for frontend (React/MUI/Vite PWA) and backend (Express/mssql/Azure Functions). Use when writing performance-sensitive code — lists, queries, rendering loops, bundle size, caching, lazy loading, memoization, virtualization, state updates. Auto-load when touching lists, queries, or render-heavy components.
---

# Performance Standards

Authoritative performance guidance for both workspaces. Code is the source of truth. Do not override explicit user instructions.

## Frontend performance

### Rendering optimization

- **`memo()` list items**: wrap components rendered in `.map()` over potentially long lists. `OrderCard` is `memo`'d because DayView renders many. Apply `memo` when a list could exceed ~10 items or the parent re-renders frequently (polling, mutations).
- **`useMemo` derived collections**: filter/sort/reduce over arrays from query data must be memoized:
  ```ts
  const activeOrders = useMemo(() => data?.orders?.filter((o) => !o.isCompleted) || [], [data]);
  const pendingAmount = useMemo(() => data?.orders?.reduce((sum, o) => o.paymentMethod === 'pending' ? sum + o.totalAmount : sum, 0) || 0, [data]);
  ```
- **`useCallback` handlers**: every function passed as a prop to a memoized child must be `useCallback`'d, or the memo is defeated.
- **Avoid inline objects in hot paths**: `sx={{ style: { color: 'red' } }}` creates a new object each render. For lists of >50 items, extract static `sx` to a module-level constant.
- **Key props**: list items must have stable, unique `key` props (`key={order.id}`). Never use array index as key for mutable lists.

### Code splitting & lazy loading

- **Route-level lazy loading**: every page except `LoginPage` is `lazy(() => import(...))` in `App.tsx`. Keep this — new pages must be lazy-loaded too.
- **Suspense fallback**: `<Suspense fallback={<PageLoader />}>` wraps routes. Do not remove.
- **Vendor manual chunks** (`vite.config.ts` `rollupOptions.output.manualChunks`): `vendor-react`, `vendor-mui`, `vendor-query`, `vendor-motion`, `vendor-charts`, `vendor-xlsx`, `vendor-icons`. When adding a major dependency (>20KB), add it to a chunk or create a new one. Keep `xlsx` (large) isolated.
- **Conditional heavy imports**: if a heavy lib is used only in one action (e.g., `xlsx` for export), use dynamic `import()` inside the handler so it is not in the initial bundle:
  ```ts
  const handleExport = async () => {
    const XLSX = await import('xlsx');
    // ...
  };
  ```

### Virtualization

- For lists exceeding **~100 items** rendered simultaneously, use virtualization (`@tanstack/react-virtual` or similar). The current order lists are small (daily orders for one cart) and do not need it.
- Do not add a virtualization dependency preemptively — wait until a real perf issue is measured.

### Bundle size

- **Terser config** (`vite.config.ts`): `drop_console: true, drop_debugger: true` in production builds. Never leave `console.log` in committed code (it is dropped in prod but visible in dev).
- **`target: 'es2020'`**: modern browsers only (PWA on iOS Safari / Android Chrome). Do not lower the target for legacy browser support — the app is not public-web.
- **`sourcemap: false`** in production. Keep sourcemaps enabled in dev (Vite default).
- Audit new dependencies before adding: prefer small, tree-shakeable packages. `lucide-react` (icons) and `recharts` are already in the bundle — do not add a second icon/chart library.
- Run `npm run build --workspace=apps/frontend` and check the chunk size report. Flag any chunk >250KB gzipped.

### Efficient state updates

- **React Query is the server-state layer** — do not duplicate API data into `useState`. Duplication causes extra renders and stale data.
- **Optimistic mutations**: update the query cache in `onMutate`, roll back in `onError`, refetch in `onSettled`. See `DayViewPage.completeMutation` — this is the pattern.
- **`setQueryData` for immediate UI feedback** — do not trigger a full `refetch` for a single-item change.
- **`cancelQueries` before `setQueryData`** in mutations to avoid race conditions with in-flight refetches.
- **Immutable cache updates**: always return new objects from `setQueryData` updater functions (spread + map), never mutate the old cache.
- **Polling**: `refetchInterval: 30000` for the main list view. Do not poll faster than 10s — it drains mobile battery. Use `refetchIntervalInBackground: false` (React Query default) to stop polling when the tab is hidden.

### PWA & caching

- **Workbox runtime caching** (`vite.config.ts`):
  - `/api/menu` → `CacheFirst`, 24h TTL (menu rarely changes).
  - `/api/(orders|supply|admin|closing-stock)` → `NetworkFirst`, 5min TTL, 5s network timeout (fresh data preferred, cache fallback offline).
  - Static assets (images/fonts) → `CacheFirst`, 30d.
- Do not cache `POST`/`PUT`/`PATCH`/`DELETE` — only GET.
- `navigateFallback: 'index.html'` for SPA routes; `navigateFallbackDenylist: [/^\/api/]` so API calls bypass the SPA fallback.
- Lighthouse PWA score target: ≥90. Test with Chrome DevTools Lighthouse after significant changes.

## Backend performance

### Connection pool

- Singleton pool (`db/pool.ts`): `max: 10, min: 0, idleTimeoutMillis: 30000`. Reuse the singleton — never open new connections per request.
- `getPool()` is cheap when connected (returns the existing pool). Call it at the top of each service function.
- Pool exhaustion (all 10 connections busy) causes request queuing. If this happens under load, investigate long-running queries before raising `max`.

### Query efficiency

- **Sargable WHERE**: query by indexed columns directly. `WHERE order_date = @date` uses `IX_Orders_OrderDate`. Avoid `WHERE CAST(order_date AS VARCHAR) = ...`.
- **No N+1**: see the `database` skill. Use JOIN + in-memory grouping or batch `IN (...)` fetches. The one existing N+1 (`listSupplyOrders`) is a known candidate for future optimization.
- **`SELECT` explicit columns**: avoid `SELECT *` in new queries — enumerate the columns you need (less network, less memory).
- **Index usage**: existing indexes cover date-based and completed-flag queries. `ORDER BY order_date DESC` aligns with the descending indexes.
- **Avoid correlated subqueries**: use JOINs for row-by-row lookups.

### JSON body & payload

- `express.json({ limit: '50kb' })` caps request bodies. This prevents memory exhaustion from large payloads. Do not raise this limit without reason — order payloads are small.
- Response payloads: keep them lean. `getOrders` returns all orders + items for a date in one response (acceptable for one cart's daily volume). If volume grows, consider pagination (see `database` skill).

### Async & I/O

- `Promise.all` for independent DB queries (e.g., fetching orders and supply data for the same date in parallel).
- Never use `Promise.all` for queries inside a transaction — they must be sequential and on the same transaction.
- `bcrypt.compare` is CPU-bound (~100ms at cost 10) — do not parallelize many login attempts; the rate limiter (5/15min) handles this.

### Memory

- Map rows to plain objects at the service boundary and discard the recordset — do not hold large `sql.IResult` objects.
- `buildMenu()` runs once at module load and the result is shared. Do not call it per-request.
- Avoid accumulating large arrays in memory across requests (no module-level caches that grow unbounded).

## Network efficiency

- **Vendor chunks** reduce repeated downloads (browser caches `vendor-react` separately from app code).
- **CacheFirst for menu** means the menu payload is downloaded once per 24h.
- **NetworkFirst with 5s timeout** for orders means users see cached data within 5s even on slow networks, then fresh data.
- **Gzip/Brotli**: Azure SWA compresses static assets automatically. Do not add compression middleware to the Express app (it runs in Azure Functions which handles this at the platform level).
- **Image sizes**: icons in `public/icons/` are 64–512px. Do not ship oversized images. Use `data:` URIs sparingly (they bypass caching).

## Caching (summary)

| Layer | Strategy | TTL |
|---|---|---|
| Menu API (FE SW) | CacheFirst | 24h |
| Orders/Admin API (FE SW) | NetworkFirst | 5min, 5s timeout |
| Static assets (FE SW) | CacheFirst | 30d |
| React Query (FE memory) | default staleTime 0, refetchInterval 30s for DayView | — |
| DB pool (BE) | singleton connection reuse | — |
| Menu in BE memory | module-level `buildMenu()` once | process lifetime |

- Do not add an HTTP-level cache (Redis, etc.) — the dataset is small and Azure SQL Free tier + Workbox caching is sufficient. Revisit only if measured latency warrants it.

## Cross-cutting rules

- Defer to the `project-context` skill for which endpoints are cacheable.
- Defer to code over drifted docs.
- Optimize based on measurement, not speculation. Do not add virtualization/caching/complexity without a demonstrated bottleneck.
- Keep the PWA Lighthouse score ≥90; test after significant FE changes.
- `npm run build --workspace=apps/frontend` and inspect chunk sizes before committing bundle-affecting changes.
