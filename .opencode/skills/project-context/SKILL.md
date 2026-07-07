---
name: project-context
description: Complete Millets Momo Order Tracker project knowledge — pages, user personas (staff/admin), business details, menu (4 fillings x 6 preparations = 24 items), prices (full/half), supply items (momo packets + sauces/dips with unit prices), plate-based pricing rules, API endpoints, DB schema, types, stock computation. Use when working on any file in apps/frontend, apps/backend, packages/shared, when asked about menu/fillings/preparations/costs/roles/stock, or when needing full project context before editing. Auto-load this whenever the task touches momo order tracking, supply, verification, closing stock, settlement, admin dashboard, or pricing.
---

# Millets Momo Order Tracker — Project Context

Authoritative project knowledge. Code is source of truth (docs drift behind).

## Business

- **Business**: Millets Momo — a momo/dumpling food cart.
- **App**: "Millets Momo Order Tracker" — internal PWA, NOT customer-facing.
- **Purpose**: Daily customer order tracking, payment recording, sales/revenue monitoring, daily reporting & analytics, supply-chain tracking (supply order → staff verification → live stock → closing stock → payment settlement reconciliation).
- **Deployment**: Azure Static Web Apps (FE PWA) + Azure Functions v4 (Express BE) + Azure SQL (Free tier). CI/CD via GitHub Actions: PR→staging, push `main`→production. Region `centralindia`; RG `millets-momo-rg`; SWA `millets-momo-swa`; SQL `millets-momo-sql`; DB `millets-momo-db`.
- **Tech**: React 18 + TS + Vite + MUI 6 + Framer Motion + React Query + react-router-dom v7 + Axios; Express 4 + Azure Functions v4 + mssql + bcryptjs + jsonwebtoken + Zod; Azure SQL / SQL Server Edge (local Docker); npm workspaces monorepo. License ISC.
- **PWA**: installable iOS Safari + Android Chrome; offline app shell; Workbox runtime caching (`/api/menu` CacheFirst 24h, `/api/orders`+`/api/admin` NetworkFirst 5min). Theme color `#1B6B3A`, bg `#F0F4F1`.
- **Design**: dark-green primary `#1B6B3A`, warm accent `#FF8C42`, card-based, radii 8/12/16/20px, dark mode supported.

## Monorepo layout

- `apps/frontend/` — React 18 + MUI 6 + Vite + PWA. Entry `src/main.tsx`.
- `apps/backend/` — Express wrapped as Azure Functions (`functions/api.ts`). Entry `src/app.ts`.
- `packages/shared/` — `src/menu.ts` (24 items), `src/pricing.ts` (simple total).
- `infra/` — Bicep. `docs/` — README/ARCHITECTURE/API/DEPLOYMENT (drifted).

## User personas / roles

Two roles only. Auth = bcrypt PIN (cost 10) → JWT (12h, `expiresIn:43200`). Token via custom header `x-auth-token` (NOT `Authorization`, avoids clashing with Azure SWA injected header).

| Role | username | PIN | displayName | Access |
|---|---|---|---|---|
| **staff** | `staff` | `9865` | "Cart Staff" | Login; DayView any date; create/edit/complete/delete orders; resolve pending payments; verify supply; record closing stock; view live stock. |
| **admin** | `admin` | `1703` | "Owner" | Everything staff can do PLUS admin-only: dashboard, supply order create/edit, staff logs, payment settlement, all `/api/admin/*`. |

Route guards: DayView/New/Edit/Verify/Closing/Stock require `staff+`; `/admin`, `/admin/supply`, `/admin/staff-logs`, `/admin/settlement` require `admin`.

Backend: `authMiddleware` verifies JWT on all `/api/*` except `/api/auth/login` + `/api/health`. `requireRole('admin')` guards `/api/admin/*` + `/api/settlement*`. Supply verification + closing-stock endpoints under `/api/supply/*` are staff+ (no admin guard). Rate limit: login 5/15min/IP; global 200/min (skips health).

## Frontend pages (apps/frontend/src/pages/)

11 pages. Routing in `src/App.tsx`.

| Page | Route | Access | Purpose |
|---|---|---|---|
| LoginPage | `/login` | public | PIN login. Role toggle (Staff/Admin) + 4-digit PinPad. "Millets Momo / Order Tracker". staff→`/day/:date`, admin→`/admin`. |
| DayViewPage | `/day/:date` | staff+ | Main staff hub. Stats (Orders/Pending ₹/Active), Active + Completed order lists (OrderCard), date picker, 30s auto-refetch, FAB new order, quick actions Verify Supply / Live Stock / Closing Stock. PaymentModal for pending. |
| NewOrderPage | `/day/:date/new` | staff+ | Build order. Menu grouped by preparation (6 cats w/ color+emoji), MenuGrid, OrderConfigPanel (order type + payment), SelectedItemsList, TotalBar. Uses OrderDraftContext. Optimistic create. |
| EditOrderPage | `/day/:date/edit/:orderId` | staff+ | Edit uncompleted order. Same UI as New, loads draft via `loadFromOrder`, submit calls `updateOrder`. |
| AdminDashboardPage | `/admin` | admin | Analytics. Date range (today/yesterday/7d/30d/custom), 4 stat chips, Supply Orders list, Stock Discrepancies, 4 charts (Payment Split, Item Breakdown, Category, Filling), Filling Performance bar, item breakdown table, Excel export. |
| StockPage | `/day/:date/stock` | staff+ | Live stock. Remaining momos per packet: Opening (yesterday closing + today verified/expected supply) − Consumed (today orders). Platter splits qty/3 per filling. Packets + loose + total. Only after supply verified. |
| SupplyOrderPage | `/admin/supply` | admin | Create/update daily supply order. Steppers for Momo Packets + Sauces & Dips, total cost + total momos, verification banner, yesterday's leftover accordion, change log. Excel export + "Create Order Text" (clipboard). |
| SupplyVerificationPage | `/day/:date/verify` | staff+ | Staff verifies delivered supply. Expected vs actual qty per item; conflict if actual≠expected. Writes verifications + `verification` staff log. |
| ClosingStockPage | `/day/:date/closing` | staff+ | End-of-day remaining stock per packet. Inputs packets left + loose pieces (0..piecesPer−1) + wastage. Expected live-stock collapsible. Mismatch→flag conflict + reason. Writes closing stock + `closing_stock` staff log. |
| PaymentSettlementPage | `/admin/settlement` | admin | Reconcile actual vs expected cash/UPI. Expected = SUM(cash_amount)+SUM(upi_amount) from non-pending orders. Conflict if diff > ₹0.01. |
| StaffLogsPage | `/admin/staff-logs` | admin | Activity logs. Tabs: Staff Activity (ClientActivityLogs) + Staff Operations (StaffOperationLogs). Filter chips + date picker. |

Note: no `DateSelectPage` file exists; root `/` redirects to `/day/{today}`.

## Menu (packages/shared/src/menu.ts) — SOURCE OF TRUTH

Canonical menu = **4 Fillings × 6 Preparations = 24 items**. `buildMenu()` iterates preparations (outer) then fillings (inner); `id` starts at 1.

### Fillings (4)
1. **Veg**
2. **Paneer**
3. **Cheese Corn**
4. **Platter** — 4th "filling" priced between Veg and Paneer. A Platter plate = **6 momos split as 2 Veg + 2 Paneer + 2 Cheese Corn** (stock consumption does `Math.round(quantity/3)` per filling).

### Preparations (6)
1. **Steam**
2. **Fry**
3. **Creamy**
4. **Creamy Fry**
5. **Nepalese Kothey**
6. **Pan Fried Gravy**

### Price matrices — FULL_PRICES[prepIdx][fillingIdx]
```
Steam:           [89,  109, 129, 109]
Fry:             [109, 129, 149, 129]
Creamy:          [129, 129, 149, 129]
Creamy Fry:      [129, 149, 169, 149]
Nepalese Kothey: [129, 139, 149, 139]
Pan Fried Gravy: [139, 149, 159, 149]
```
### HALF_PRICES[prepIdx][fillingIdx]
```
Steam:           [50, 60, 70, 60]
Fry:             [60, 70, 80, 70]
Creamy:          [60, 70, 80, 70]
Creamy Fry:      [70, 80, 90, 80]
Nepalese Kothey: [70, 75, 80, 75]
Pan Fried Gravy: [75, 80, 85, 80]
```

### Full menu (id, displayName = "{Filling} {Preparation}", full ₹, half ₹)

| ID | Filling | Preparation | displayName | Full | Half |
|---|---|---|---|---|---|
| 1 | Veg | Steam | Veg Steam | 89 | 50 |
| 2 | Paneer | Steam | Paneer Steam | 109 | 60 |
| 3 | Cheese Corn | Steam | Cheese Corn Steam | 129 | 70 |
| 4 | Platter | Steam | Platter Steam | 109 | 60 |
| 5 | Veg | Fry | Veg Fry | 109 | 60 |
| 6 | Paneer | Fry | Paneer Fry | 129 | 70 |
| 7 | Cheese Corn | Fry | Cheese Corn Fry | 149 | 80 |
| 8 | Platter | Fry | Platter Fry | 129 | 70 |
| 9 | Veg | Creamy | Veg Creamy | 129 | 60 |
| 10 | Paneer | Creamy | Paneer Creamy | 129 | 70 |
| 11 | Cheese Corn | Creamy | Cheese Corn Creamy | 149 | 80 |
| 12 | Platter | Creamy | Platter Creamy | 129 | 70 |
| 13 | Veg | Creamy Fry | Veg Creamy Fry | 129 | 70 |
| 14 | Paneer | Creamy Fry | Paneer Creamy Fry | 149 | 80 |
| 15 | Cheese Corn | Creamy Fry | Cheese Corn Creamy Fry | 169 | 90 |
| 16 | Platter | Creamy Fry | Platter Creamy Fry | 149 | 80 |
| 17 | Veg | Nepalese Kothey | Veg Nepalese Kothey | 129 | 70 |
| 18 | Paneer | Nepalese Kothey | Paneer Nepalese Kothey | 139 | 75 |
| 19 | Cheese Corn | Nepalese Kothey | Cheese Corn Nepalese Kothey | 149 | 80 |
| 20 | Platter | Nepalese Kothey | Platter Nepalese Kothey | 139 | 75 |
| 21 | Veg | Pan Fried Gravy | Veg Pan Fried Gravy | 139 | 75 |
| 22 | Paneer | Pan Fried Gravy | Paneer Pan Fried Gravy | 149 | 80 |
| 23 | Cheese Corn | Pan Fried Gravy | Cheese Corn Pan Fried Gravy | 159 | 85 |
| 24 | Platter | Pan Fried Gravy | Platter Pan Fried Gravy | 149 | 80 |

- Half-price formula: `computeHalfPrice(full) = Math.round((full + 11) / 2)`.
- Sauces/dips are NOT in the menu (momos only). They're SupplyItems consumed as accompaniments, not sold per-order.

## Pricing (THE backend is source of truth for orders — server recomputes, client totals ignored)

### Plate-based model — `apps/backend/src/utils/pricing.ts` `computeLineTotal(menuItemId, quantity, isHalf)`
1. **Half plate preset**: `isHalf && quantity===3` → `lineTotal = halfPrice` (3 momos @ half).
2. **Full plate preset**: `!isHalf && quantity===6` → `lineTotal = fullPrice` (6 momos @ full).
3. **Custom quantity** (else):
   - `fullPlates = floor(q/6)`, `rem = q%6`
   - `rem===0` → `fullPlates × fullPrice`
   - `rem ≤ 4` → `perMomo = round(halfPrice/3)`; `fullPlates×fullPrice + rem×perMomo`
   - `rem === 5` → `perMomo = round(fullPrice/6)`; `fullPlates×fullPrice + 5×perMomo`
   - `unitPrice = round(halfPrice/3)` (loose-piece unit)

`computeOrderTotal(items) = Σ lineTotal`. Frontend `apps/frontend/src/utils/pricing.ts` is same logic + `isCustom` boolean.

### OrderDraftContext modes (per draft item)
- **Full** (`isHalf=false, isCustom=false`): default 6 @ fullPrice. Re-tap `setFull` +6.
- **Half** (`isHalf=true, isCustom=false`): default 3 @ halfPrice. Re-tap `setHalf` +3.
- **Custom** (`isCustom=true`): per-momo stepper; `setCustom` +1 each tap.
- `loadFromOrder` sets `isCustom=true` when quantity isn't exactly 3-half or 6-full.

### Order totals + payment split (ordersService)
- `id = Date.now()` (epoch-ms BIGINT PK).
- `totalAmount = computeOrderTotal(items)`.
- `cash` → `cashAmount=total, upi=0`. `upi` → `upi=total, cash=0`. `split` → provided cash/upi. `pending` → both 0 (resolved at completion).
- Complete-order: pending must supply `paymentMethod` (cash/upi/split); split upi defaults to `total−cash`.

## Supply items (apps/backend/src/db/seed.sql) — 8 items

Table `SupplyItems(id, name, category, unit_price, pieces_per, display_name, is_active)`. `pieces_per` default 1.

| ID | name | category | unitPrice ₹ | piecesPer | displayName |
|---|---|---|---|---|---|
| 1 | `veg_packet` | momo_packet | 138.00 | 24 | Veg Momo Packet (24 Pcs) |
| 2 | `paneer_packet` | momo_packet | 158.00 | 24 | Paneer Momo Packet (24 Pcs) |
| 3 | `cheese_corn_packet` | momo_packet | 198.00 | 24 | CheeseCorn Momo Packet (24 Pcs) |
| 4 | `red_sauce` | sauce | 80.00 | 1 | Red Sauce |
| 5 | `chipotle` | dip | 220.00 | 1 | Chipotle |
| 6 | `schezwan_sauce` | sauce | 170.00 | 1 | Schezwan Sauce |
| 7 | `oregano` | dip | 370.00 | 1 | Oregano |
| 8 | `molten_cheese` | dip | 160.00 | 1 | Molten Cheese |

- Each momo packet = **24 pieces**. Sauces/dips `piecesPer=1` (per pack, not per piece).
- Supply order `totalCost = Σ unitPrice × qty`. Total momos (UI) = `Σ (momo_packet qty × 24)`.
- One supply order per date (`UQ_DailySupplyOrders_Date`).
- `updateSupplyOrder` deletes existing order + items + verifications for that date, re-creates with action `UPDATE`.

## Filling ↔ packet mapping (for stock consumption)

| Menu filling | Supply packet (supplyItemId) |
|---|---|
| Veg | Veg Momo Packet (1) |
| Paneer | Paneer Momo Packet (2) |
| Cheese Corn | CheeseCorn Momo Packet (3) |
| Platter | splits `Math.round(quantity/3)` to Veg + Paneer + Cheese Corn packets |

**Mapping rule in code** (StockPage.tsx:128): `fullFilling = displayName.includes('Cheese Corn') ? 'Cheese Corn' : displayName.split(' ')[0]`. ⚠️ This is a known bug source — see Bug 3 note below.

## Stock computation (shared by StockPage, ClosingStockPage, AdminDashboard)

- **Opening** = yesterday's closing stock (packets×24 + pieces) + today's supply (verified `actualQty`, else `expectedQty`)×24.
- **Consumed** = Σ order item quantities where `menuItem.filling === packet filling`; Platter orders split `Math.round(quantity/3)` per filling.
- **Remaining** = `max(0, Opening − Consumed)`.
- Only `momo_packet` category tracked (sauces/dips excluded from stock math).
- **`isFullyVerified`** = all verification items have `actualQty !== null`. **`conflictCount`** = items with `hasConflict` (actualQty ≠ expectedQty).
- Closing stock pieces constraint: `pieces_left` 0–23 (full packet → packet, not 24 loose).
- Settlement expected = `SUM(cash_amount)` + `SUM(upi_amount)` from Orders where `payment_method != 'pending'`. Conflict if `|actual−expected| > 0.01`.

## Backend API endpoints (Express, base `/api`)

All protected routes require `x-auth-token` header.

### Auth + Health
- `POST /api/auth/login` (rate-limited 5/15min) → `authController.login`
- `GET /api/health` (none) — checks DB pool

### Menu
- `GET /api/menu` (staff+) → 24 items

### Orders (staff+)
- `GET /api/orders?date=YYYY-MM-DD` → `ordersController.getOrders`
- `POST /api/orders` → create (+ `order_create` staff log)
- `PUT /api/orders/:id` → update (+ `order_update` staff log)
- `PATCH /api/orders/:id/complete` → completeOrder
- `DELETE /api/orders/:id` → deleteOrder

### Admin (`/api/admin` — all require admin)
- `GET /api/admin/summary?date=&endDate=` → getSummary
- `GET /api/admin/supply/items` → supplyController.getItems
- `GET /api/admin/supply/order?date=` → getOrder
- `GET /api/admin/supply/orders?date=&endDate=` → listOrders
- `GET /api/admin/supply/logs?date=` → getLogs
- `POST /api/admin/supply/order` → createOrder (action CREATE)
- `PUT /api/admin/supply/order` → upsertOrder (action UPDATE; deletes verifications)
- `GET /api/admin/staff-logs?date=&type=` → staffLogController
- `GET /api/admin/client-logs?date=&type=&limit=` → clientLogController
- `GET /api/admin/settlement?date=` / `POST /api/admin/settlement` / `GET /api/admin/settlements?startDate=&endDate=` → paymentSettlementController

### Supply Verification & Closing Stock (`/api/supply` — staff+)
- `GET /api/supply/verifications?startDate=&endDate=` → listVerifications
- `GET /api/supply/verification?date=` → getVerification
- `POST /api/supply/verification` → createVerification (+ `verification` staff log)
- `GET /api/supply/closing-stock?date=` → getClosingStock
- `POST /api/supply/closing-stock` → createClosingStock (+ `closing_stock` staff log)

### Client Logs
- `POST /api/client-logs` (none) → batch insert frontend telemetry

### StaffOperationLog types (enum)
`verification` | `closing_stock` | `order_create` | `order_update`. Written server-side by orders/supplyVerification/closingStock controllers via `staffLogService.createLog`.

## Key types (3 parallel defs kept in sync: packages/shared, apps/frontend/src/types, backend per-service)

- **MenuItem**: `id, filling, preparation, displayName, fullPrice, halfPrice`
- **OrderItem**: `menuItemId, itemName, quantity, isHalf, unitPrice, lineTotal`
- **Order**: `id, orderDate, timeLabel, orderType('dine'|'pack'), paymentMethod('cash'|'upi'|'split'|'pending'), isCompleted, totalAmount, cashAmount, upiAmount, items: OrderItem[]`
- **User**: `id, username, role('staff'|'admin'), displayName`
- **SupplyItem**: `id, name, category('momo_packet'|'sauce'|'dip'), unitPrice, piecesPer, displayName`
- **SupplyOrderItem**: `supplyItemId, name, displayName, category, quantity, unitPrice, lineTotal, piecesPer`
- **SupplyOrder**: `id, orderDate, totalCost, createdBy, createdAt, items: SupplyOrderItem[]`
- **SupplyOrderLog**: `id, orderDate, action('CREATE'|'UPDATE'), createdBy, createdAt, itemSummary, displayName`
- **SupplyVerificationItem**: `supplyItemId, displayName, category, expectedQty, actualQty(number|null), hasConflict, unitPrice, piecesPer`
- **SupplyVerification**: `orderDate, items, isFullyVerified, conflictCount`
- **ClosingStockItem**: `supplyItemId, displayName, category, piecesPer, packetsLeft, piecesLeft, wastagePieces, hasConflict, conflictReason(string|null), totalPiecesLeft`
- **ClosingStock**: `orderDate, items, isSubmitted`
- **StaffOperationLog**: `id, orderDate, operationType, createdBy, createdAt, details, displayName`
- **AdminSummary**: `date, endDate, totalOrders, totalRevenue, pendingAmount, cashTotal, upiTotal, itemBreakdown[{itemName,totalQuantity,totalRevenue}], orders`
- **DailyPaymentSettlement**: `id, orderDate, expectedCash, expectedUpi, actualCash, actualUpi, cashConflict, upiConflict, notes, createdBy, createdAt`

## DB schema (apps/backend/src/db/schema.sql) — 13 tables

`Users`, `MenuItems` (UQ filling+preparation), `Orders` (BIGINT epoch-ms PK, payment_method CHECK cash|upi|split|pending), `OrderItems` (CASCADE on order), `SupplyItems` (category CHECK momo_packet|sauce|dip), `DailySupplyOrders` (UQ order_date), `DailySupplyOrderItems` (CASCADE), `SupplyOrderLogs`, `SupplyVerifications` (UQ date+item), `DailyClosingStock` (UQ date+item, pieces_left 0..23), `StaffOperationLogs`, `ClientActivityLogs`, `DailyPaymentSettlements` (UQ order_date).

All queries use parameterized `request.input()` — string interpolation into SQL forbidden.

## Commands (run from root)

- `npm run local:setup` — Docker SQL + wait + create DB + schema + seed
- `npm run local:dev` — FE (Vite) + BE (Azure Functions) concurrently
- `npm run local:db:migrate` / `:seed` — schema+seed / seed only on local
- `npm run prod:setup` — deploy all Azure infra via Bicep
- `npm test` — all workspaces; `npm run lint`; `npm run typecheck`
- `npm run generate-pin-hash` — bcrypt hash for a 4-digit PIN

## Known bug-prone spots (reference when fixing)

1. **SupplyOrderPage "Create Order Text" on mobile** (SupplyOrderPage.tsx:117-138): `createOrderText()` builds clipboard text. Mobile clipboard APIs (`navigator.clipboard.writeText`) can fail/strip on some mobile browsers; sauces/dips may be dropped. Check `allItems` construction + `qty > item.minQty` filter (sauces minQty=1).
2. **DayViewPage summary item breakdown**: AdminDashboard/OrderCard summaries must show all 3 fillings (Veg/Paneer/Cheese Corn) + all 6 preparations (Steam/Fry/Creamy/Creamy Fry/Nepalese Kothey/Pan Fried Gravy). If grouping logic drops fillings/preps, check the breakdown aggregation.
3. **StockPage Cheese Corn consumption** (StockPage.tsx:128): `fullFilling = displayName.includes('Cheese Corn') ? 'Cheese Corn' : displayName.split(' ')[0]`. Supply item displayName is "CheeseCorn Momo Packet (24 Pcs)" — note "CheeseCorn" has NO space, so `.includes('Cheese Corn')` is FALSE, and `split(' ')[0]` returns "CheeseCorn" not "Cheese Corn". Menu filling is "Cheese Corn" (with space). → match fails → Cheese Corn consumed never counted. Fix: match against the supply item's intended filling explicitly, or normalize "CheeseCorn"→"Cheese Corn".
