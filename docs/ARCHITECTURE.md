# Architecture

## Overview

Millets Momo is a monorepo PWA for daily order tracking at a momo cart. It uses a **three-workspace** npm workspaces layout with shared menu/pricing logic.

```
packages/shared ──► apps/frontend
                 ──► apps/backend
```

## Frontend (`apps/frontend`)

- **React 18** + **MUI 6** + **Vite** SPA
- **react-router-dom v7** for client-side routing
- **@tanstack/react-query v5** for server state (caching, refetch, mutations)
- **Axios** with JWT interceptor for API calls
- **vite-plugin-pwa** generates a service worker (Workbox `generateSW`) with runtime caching:
  - `/api/menu` → CacheFirst (24h TTL)
  - `/api/orders`, `/api/admin` → NetworkFirst (5min TTL)
- **Theme**: MUI theme per PRD §6 — dark green primary (`#1B6B3A`), warm accent (`#FF8C42`), status badges, RTL-safe
- **Auth**: PIN-based login → JWT stored in `sessionStorage` — 12h expiry, auto-redirect on 401
- **State**: `OrderDraftContext` manages in-progress order drafts (items map, order type, payment method)

### Route Table

| Path | Component | Access |
|---|---|---|
| `/login` | `LoginPage` | Public |
| `/dates` | `DateSelectPage` | Staff+ |
| `/day/:date` | `DayViewPage` | Staff+ |
| `/day/:date/new` | `NewOrderPage` | Staff+ |
| `/admin` | `AdminDashboardPage` | Admin only |

### Component Tree

```
App
├── AuthProvider (sessionStorage token/role)
├── ThemeProvider (MUI theme)
└── Routes
    ├── LoginPage
    │   └── PinPad
    ├── DateSelectPage
    ├── DayViewPage
    │   ├── OrderCard (×N)
    │   ├── StatChip (×4)
    │   └── FAB → /day/:date/new
    ├── NewOrderPage
    │   ├── OrderDraftProvider
    │   ├── MenuGrid
    │   ├── OrderConfigPanel
    │   ├── SelectedItemsList
    │   └── TotalBar
    └── AdminDashboardPage
        └── PaymentModal (on /day/:date via state)
```

## Backend (`apps/backend`)

- **Express 4** app wrapped in **Azure Functions v4** HTTP trigger (`functions/api.ts`)
- Middleware stack: `helmet()` → `cors()` → `express.json({limit:'50kb'})` → `morgan()` → routes → `errorHandler`
- **Authentication**: bcrypt PIN verification → JWT (`jsonwebtoken`, 12h expiry, `JWT_SECRET` env var)
- **Authorization**: `authMiddleware` sets `req.user`; `requireRole('admin')` guards admin routes
- **Rate limiting**: `express-rate-limit` on `POST /api/auth/login` — 5 requests per 15 minutes per IP
- **Validation**: All endpoint inputs validated with **Zod** schemas (`src/validators/`)
- **Database**: Azure SQL via `mssql` driver; singleton connection pool (`db/pool.ts`). ALL queries use parameterized `request.input()` — no string interpolation.

### Service Layer

| Service | Responsibility |
|---|---|
| `authService` | PIN login, bcrypt verify, JWT issue |
| `menuService` | Return canonical 6×4 menu grid |
| `ordersService` | CRUD orders; server-side total recomputation; transactional inserts |
| `adminService` | Aggregate summary (totals, breakdown), order list per date |

### Data Flow (Create Order)

1. Client POSTs `{ orderDate, orderType, paymentMethod, items[] }` with JWT
2. `authMiddleware` verifies token, sets `req.user`
3. `createOrderSchema` validates payload via Zod
4. `ordersService.createOrder`:
   - Generates `id = Date.now()` (epoch-ms, BIGINT PK)
   - Recomputes total from server-side canonical menu (never trusts client totals)
   - Opens transaction, INSERTs `Orders` row + N `OrderItems` rows
   - Commits or rolls back
5. Returns full order object

## Shared Package (`packages/shared`)

- `menu.ts`: Canonical 6×4 menu grid (4 fillings × 6 preparations = 24 items), `buildMenu()` factory
- `pricing.ts`: `computeHalfPrice(full) = round((full + 11) / 2)`, `calculateOrderTotal(items[])`
- `types.ts`: Shared TypeScript interfaces (`MenuItem`, etc.)
- Consumed by both frontend (for display pricing) and backend (for canonical price authority)

## Database Schema

4 tables in Azure SQL:

| Table | Purpose | Key Columns |
|---|---|---|
| `Users` | Staff/admin accounts | `id`, `username`, `role`, `pin_hash` (bcrypt), `display_name`, `is_active` |
| `MenuItems` | Canonical menu catalog | `id`, `filling`, `preparation`, `display_name`, `full_price`, `half_price` |
| `Orders` | Daily orders | `id` (BIGINT epoch-ms), `order_date`, `time_label`, `order_type`, `payment_method`, `is_completed`, `total_amount` |
| `OrderItems` | Line items per order | `id`, `order_id` (FK→Orders, CASCADE), `menu_item_id`, `item_name`, `quantity`, `is_half`, `unit_price`, `line_total` |

Indexes: `IX_Orders_OrderDate`, `IX_Orders_Completed`, `IX_OrderItems_OrderId`

## Security

- No secrets in Git — `local.settings.json` gitignored, `local.settings.example.json` documents env vars
- PINs stored as bcrypt hashes (cost factor 10)
- JWT with 12h expiry; `authMiddleware` on all protected routes
- All SQL uses parameterized queries (`request.input()`)
- `helmet()` sets security headers; CSP restricts to `'self'` + Azure SWA origin
- JSON body limited to 50kb
- `dangerouslySetInnerHTML` forbidden in ESLint rules
- Rate-limited login endpoint (5/15min per IP)

## PWA & Offline

- `vite-plugin-pwa` with `generateSW` strategy
- Manifest: standalone, portrait, theme `#1B6B3A`, background `#F0F4F1`
- Icons: `public/icons/icon-*.png` (64–512px) + `maskable-512.png`
- iOS meta tags: `apple-mobile-web-app-capable`, `apple-mobile-web-app-title`, `apple-touch-icon`
- App shell loads offline; API calls cached via Workbox runtime strategies