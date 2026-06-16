# PRODUCT REQUIREMENTS DOCUMENT
# Millets Momo — Daily Order Tracking PWA

**Monorepo · React + MUI · Node.js (Azure Functions) · Azure SQL Database**

| | |
|---|---|
| Version | 1.0 |
| Document Date | 17 June 2026 |

> **AUDIENCE:** This document is written for an autonomous AI coding agent. It is fully self-contained, specifies exact implementation details (schema, API contracts, design tokens, file structure, security rules, and deployment steps), and requires no further clarification from a human before implementation begins.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Goals, Scope & Non-Goals](#2-goals-scope--non-goals)
3. [System Architecture](#3-system-architecture)
4. [Technology Stack](#4-technology-stack)
5. [Monorepo Structure](#5-monorepo-structure)
6. [Design System & Theming](#6-design-system--theming)
7. [PWA Requirements](#7-pwa-requirements)
8. [Data Model & Database Schema](#8-data-model--database-schema-azure-sql--t-sql)
9. [Menu & Pricing Reference Data](#9-menu--pricing-reference-data)
10. [Business Logic & Rules](#10-business-logic--rules)
11. [API Specification](#11-api-specification)
12. [Frontend Specification](#12-frontend-specification)
13. [Authentication & Security](#13-authentication--security-requirements)
14. [Testing Requirements](#14-testing-requirements)
15. [Deployment & DevOps Plan](#15-deployment--devops-plan)
16. [Environment Variables & Configuration](#16-environment-variables--configuration)
17. [README Requirements](#17-readme-requirements)
18. [Non-Functional Requirements](#18-non-functional-requirements)
19. [Acceptance Criteria / Definition of Done](#19-acceptance-criteria--definition-of-done)
20. [Implementation Roadmap](#20-implementation-roadmap-suggested-build-order)

---

## 1. Project Overview

Millets Momo is a small food cart business selling momos (steamed/fried dumplings) in 24 fixed combinations (4 fillings × 6 preparation styles). This project delivers a Progressive Web App (PWA) used internally by the business to record customer orders at the cart and to view daily sales summaries.

The application has two personas:

- **Staff (cart worker):** logs in with a PIN, selects a date, and records orders as customers place them, with item selection, quantity, half-plate option, order type (Dine in / Pack), and payment status (Cash / UPI / Pending).
- **Admin (owner):** logs in with a separate PIN and views a daily dashboard — total orders, total revenue, payment-method breakdown, pending amount, and a per-item quantity/revenue breakdown for any selected date.

The application must be installable as a PWA directly from the browser on both iOS (Safari "Add to Home Screen") and Android (Chrome "Install app"), and must work well on phone, tablet, and desktop screens. It will be used by no more than 10 concurrent users at any time, so the architecture favours simplicity, low operating cost (Azure free tiers), and low maintenance over horizontal scalability.

A fully working HTML/CSS/JS prototype of the UI already exists and defines the exact visual design, colour palette, spacing, component layout, copy/wording, and interaction patterns (PIN pad, menu grid, order cards, completion flow, admin dashboard). This PRD converts that prototype into a production-grade monorepo application while preserving its design 1:1. Section 6 ("Design System & Theming") translates every visual detail of the prototype into an MUI theme specification — the coding agent **MUST** reproduce this design exactly, not redesign it.

---

## 2. Goals, Scope & Non-Goals

### 2.1 In-Scope Functional Requirements

1. PIN-based login with two roles: Staff and Admin, selectable via tabs labelled **"Staff"** and **"Admin"** on the login screen.
2. Date selection screen (Staff): pick any date (defaults to today), with "Today" / "Yesterday" quick-select buttons and a list of the 5 most recent days with order counts and revenue totals.
3. Day View (Staff): shows all orders placed for the selected date, with summary stat chips (order count, revenue, pending amount), an "Active orders" section, a horizontal divider, and a "Completed" section below it.
4. "New Order" creation flow reachable via a floating action button and a top-bar button.
5. Menu grid for order entry: a 6×4 grid (6 preparation styles × 4 fillings = 24 items). Tapping a cell adds 1 unit of that item to the order; tapping again increases quantity. Long-press (or right-click on desktop) toggles Half Plate for that item. No prices are shown per cell except a small full-price hint; the live order total is shown in a sticky bottom bar.
6. Order summary panel below the menu and order-detail controls, listing each selected item with quantity +/- controls, a Full/Half toggle, and a line total. Order name format is `"{Filling} {Preparation}"`, e.g. "Veg Steam", "Paneer Creamy Fry", "Cheese Corn Pan Fried".
7. Order detail controls: Order Type — "Dine in" or "Pack" (default Dine in); Payment Method — "Cash", "UPI", or "Pending" (default Cash).
8. On submit, the order is saved with a timestamp-based order number/ID and a human-readable time label (e.g. "02:45 PM", Asia/Kolkata time), and appears as a new order card in the Day View "Active orders" section.
9. Each order card shows: time label, order-type badge, payment badge, item list with quantities and half-plate indicators, total amount, a "✓ Done" button, and a "✕" delete button.
10. Marking an order "Done": if its payment method is "Pending", a bottom-sheet modal must appear asking the staff member to choose the actual payment method received (Cash or UPI) before the order is marked complete and its `payment_method` is updated accordingly. If payment is already Cash or UPI, the order is marked complete immediately.
11. Completed orders move to the "Completed" section below the divider on the Day View, visually de-emphasised (reduced opacity, grey left border).
12. Admin Dashboard: a separate tab/screen reachable only after Admin login. Contains a date picker, four summary cards (Total orders, Total revenue, Pending amount, Cash/UPI split), a per-item breakdown table (item name, total quantity sold, total revenue) sorted by quantity descending with a totals row, and a read-only list of all orders for that date.
13. Responsive layout for phone (≥360px), tablet (≥768px), and desktop (≥1024px), matching the prototype's breakpoints and behaviour.
14. Smooth, subtle animations matching the prototype: fade-in on screen transitions, slide-up on new order cards and modals, pop-in on the login card, shake on PIN error.
15. Basic validation: cannot submit an order with zero items; cannot proceed without selecting a date; PIN must be exactly 4 digits; date inputs must be valid dates.

### 2.2 Non-Functional Requirements (Summary)

- Installable PWA on iOS Safari and Android Chrome, working fully offline for the app shell.
- Security: PIN hashing, JWT-based session, Helmet security headers, parameterized SQL queries (no SQL injection), input validation (no XSS), rate limiting on login.
- Unit tests on both frontend and backend covering business logic, components, and API endpoints.
- Well-documented, well-structured TypeScript code with a complete root `README.md`.
- Deployable on Azure free tiers: Azure Static Web Apps (frontend + managed Functions API) and Azure SQL Database (Free offer tier).

### 2.3 Out of Scope (Explicitly Not Required)

- Editing an order after submission (only "mark complete" and "delete" are supported).
- Customer-facing ordering (this is an internal staff/admin tool only).
- Online/integrated payment processing (Cash/UPI are recorded as labels only, no payment gateway).
- Multi-cart / multi-location support, push notifications, SMS/email, multi-language support.
- User self-registration — only two fixed accounts (Staff, Admin) seeded at setup time.

---

## 3. System Architecture

### 3.1 High-Level Architecture

The system is a single-page application (SPA) built with React, served as static files together with a Service Worker (PWA). All dynamic data flows through a REST API implemented as a single Azure Functions app (Node.js + Express, wrapped via an HTTP trigger). The API connects to a single Azure SQL Database (Free offer tier) using parameterized queries via the `mssql` package.

```
┌──────────────────────────┐        HTTPS         ┌───────────────────────────────┐
│   Client Device (PWA)    │ ───────────────────▶ │   Azure Static Web App         │
│  iOS Safari / Android     │                       │   - Serves built React app     │
│  Chrome - installed as     │ ◀─────────────────── │   - /api/* routed to Functions │
│  home-screen app           │     JSON over HTTPS  │   - Managed Azure Functions    │
└──────────────────────────┘                       │     (Node.js + Express app)    │
                                                     └───────────────┬───────────────┘
                                                                      │ mssql (TDS, encrypted)
                                                                      ▼
                                                     ┌───────────────────────────────┐
                                                     │   Azure SQL Database           │
                                                     │   (Free offer tier)            │
                                                     │   Tables: Users, MenuItems,    │
                                                     │   Orders, OrderItems           │
                                                     └───────────────────────────────┘
```

### 3.2 Authentication Flow

1. Staff/Admin selects a tab ("Staff" or "Admin") on the login screen and enters a 4-digit PIN via an on-screen numeric pad.
2. Frontend POSTs `{ role, pin }` to `POST /api/auth/login`.
3. Backend looks up the active user(s) for that role, compares the PIN against the stored bcrypt hash using `bcrypt.compare`.
4. On success, backend issues a signed JWT (containing `userId`, `role`, `displayName`, `exp`) and returns it with `role` and `displayName`.
5. Frontend stores the JWT in memory + sessionStorage (not localStorage, to reduce persistence risk on shared devices), and attaches it as `Authorization: Bearer <token>` on all subsequent API calls.
6. Backend middleware verifies the JWT on every protected route and enforces role-based access (e.g., only `"admin"` may call `/api/admin/summary`).
7. On 401 responses, the frontend clears the session and redirects to the login screen.

### 3.3 Data Flow for Orders

- Staff opens Day View for a date → frontend calls `GET /api/orders?date=YYYY-MM-DD` → backend returns all orders + nested items for that date.
- Staff builds a new order (client-side state only) → on submit, frontend calls `POST /api/orders` → backend validates, recomputes totals server-side, inserts Orders + OrderItems rows in a transaction, returns the created order.
- Staff marks an order complete → `PATCH /api/orders/:id/complete` with optional `{ paymentMethod }` body → backend updates `is_completed`, `completed_at`, and `payment_method` if provided.
- Staff deletes an order → `DELETE /api/orders/:id` → backend deletes the order (cascade deletes its items).
- Admin opens dashboard → `GET /api/admin/summary?date=YYYY-MM-DD` → backend aggregates totals in SQL and returns a single summary object plus the order list.

---

## 4. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend framework | React 18 + TypeScript | Functional components + hooks only |
| Build tool | Vite | Fast dev server, small production bundles |
| UI library | MUI (Material UI) v5 | Theme customised per Section 6 |
| PWA tooling | vite-plugin-pwa (Workbox) | Manifest + service worker + offline cache |
| Routing | react-router-dom v6 | Client-side routing with protected routes |
| Server state | @tanstack/react-query | Caching, refetch, optimistic updates |
| HTTP client | axios | Centralised API client with interceptors |
| Backend runtime | Node.js 20 LTS | Matches Azure Functions Node 20 support |
| Backend framework | Express.js + TypeScript | Wrapped by Azure Functions HTTP trigger via serverless-http |
| Hosting platform | Azure Functions v4 (Node programming model) | Bundled inside Azure Static Web Apps "api" location |
| Database | Azure SQL Database (Free offer tier) | Serverless compute, T-SQL, accessed via `mssql` package |
| Authentication | JWT (jsonwebtoken) + bcrypt | PINs hashed with bcrypt; sessions via short-lived JWT |
| Security middleware | helmet, cors, express-rate-limit | Applied in Express app (see Section 13) |
| Validation | zod | Schema validation for all request bodies/queries |
| Frontend testing | Vitest + React Testing Library | Component & utility unit tests |
| Backend testing | Jest + Supertest + ts-jest | Controller, middleware, and integration tests |
| Linting/formatting | ESLint + Prettier | Shared config at repo root |
| Hosting/Deployment | Azure Static Web Apps + GitHub Actions | See Section 15 |

---

## 5. Monorepo Structure

The project **MUST** be a single Git repository using npm workspaces, structured exactly as follows. Create every file/folder listed, even if some files only contain scaffolding initially.

```
millets-momo/
├── apps/
│   ├── frontend/                      # React + Vite + MUI PWA
│   │   ├── public/
│   │   │   ├── icons/                 # PWA icons: 64,128,192,256,384,512 px (PNG)
│   │   │   │   └── maskable-512.png
│   │   │   └── robots.txt
│   │   ├── src/
│   │   │   ├── api/
│   │   │   │   ├── client.ts          # axios instance + interceptors
│   │   │   │   ├── authApi.ts
│   │   │   │   ├── menuApi.ts
│   │   │   │   ├── ordersApi.ts
│   │   │   │   └── adminApi.ts
│   │   │   ├── components/
│   │   │   │   ├── PinPad.tsx
│   │   │   │   ├── MenuGrid.tsx
│   │   │   │   ├── OrderConfigPanel.tsx
│   │   │   │   ├── SelectedItemsList.tsx
│   │   │   │   ├── TotalBar.tsx
│   │   │   │   ├── OrderCard.tsx
│   │   │   │   ├── PaymentModal.tsx
│   │   │   │   ├── StatChip.tsx
│   │   │   │   ├── Toast.tsx
│   │   │   │   └── ProtectedRoute.tsx
│   │   │   ├── pages/
│   │   │   │   ├── LoginPage.tsx
│   │   │   │   ├── DateSelectPage.tsx
│   │   │   │   ├── DayViewPage.tsx
│   │   │   │   ├── NewOrderPage.tsx
│   │   │   │   └── AdminDashboardPage.tsx
│   │   │   ├── context/
│   │   │   │   ├── AuthContext.tsx
│   │   │   │   └── OrderDraftContext.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useOrders.ts
│   │   │   │   ├── useMenu.ts
│   │   │   │   └── useAdminSummary.ts
│   │   │   ├── theme/
│   │   │   │   ├── theme.ts           # MUI theme (Section 6)
│   │   │   │   └── tokens.ts          # status color tokens
│   │   │   ├── utils/
│   │   │   │   ├── pricing.ts         # half-price formula, totals
│   │   │   │   ├── dateUtils.ts
│   │   │   │   └── formatters.ts
│   │   │   ├── types/
│   │   │   │   └── index.ts           # shared TS interfaces (mirrors packages/shared)
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   └── vite-env.d.ts
│   │   ├── tests/
│   │   │   ├── PinPad.test.tsx
│   │   │   ├── MenuGrid.test.tsx
│   │   │   ├── TotalBar.test.tsx
│   │   │   ├── OrderCard.test.tsx
│   │   │   ├── PaymentModal.test.tsx
│   │   │   └── pricing.test.ts
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── .eslintrc.cjs
│   │   ├── .env.example
│   │   └── package.json
│   │
│   └── backend/                       # Azure Functions (Node.js + Express)
│       ├── src/
│       │   ├── functions/
│       │   │   └── api.ts             # single HTTP trigger, wraps Express app
│       │   ├── app.ts                 # Express app: middleware + route mounting
│       │   ├── routes/
│       │   │   ├── authRoutes.ts
│       │   │   ├── menuRoutes.ts
│       │   │   ├── ordersRoutes.ts
│       │   │   └── adminRoutes.ts
│       │   ├── controllers/
│       │   │   ├── authController.ts
│       │   │   ├── menuController.ts
│       │   │   ├── ordersController.ts
│       │   │   └── adminController.ts
│       │   ├── services/
│       │   │   ├── authService.ts
│       │   │   ├── menuService.ts
│       │   │   ├── ordersService.ts
│       │   │   └── adminService.ts
│       │   ├── db/
│       │   │   ├── pool.ts            # mssql connection pool singleton
│       │   │   ├── schema.sql         # DDL (Section 8)
│       │   │   └── seed.sql           # seed data (Sections 8 & 9)
│       │   ├── middleware/
│       │   │   ├── authMiddleware.ts
│       │   │   ├── errorHandler.ts
│       │   │   └── rateLimiter.ts
│       │   ├── validators/
│       │   │   ├── authValidators.ts
│       │   │   └── orderValidators.ts
│       │   ├── constants/
│       │   │   └── menu.ts            # 24-item menu + pricing (Section 9)
│       │   └── utils/
│       │       ├── pricing.ts         # half-price formula (shared logic)
│       │       └── time.ts            # Asia/Kolkata date/time helpers
│       ├── tests/
│       │   ├── auth.test.ts
│       │   ├── menu.test.ts
│       │   ├── orders.test.ts
│       │   ├── admin.test.ts
│       │   └── pricing.test.ts
│       ├── scripts/
│       │   ├── migrate.ts             # runs schema.sql against Azure SQL
│       │   └── generatePinHash.ts     # CLI: bcrypt-hash a PIN for env vars
│       ├── host.json
│       ├── local.settings.example.json
│       ├── tsconfig.json
│       ├── .eslintrc.cjs
│       └── package.json
│
├── packages/
│   └── shared/                        # Types & constants shared by both apps
│       ├── src/
│       │   ├── types.ts               # Order, OrderItem, MenuItem, User, etc.
│       │   ├── menu.ts                # canonical 24-item menu definition
│       │   └── pricing.ts             # canonical half-price formula
│       ├── package.json
│       └── tsconfig.json
│
├── .github/
│   └── workflows/
│       └── azure-deploy.yml
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   └── DEPLOYMENT.md
├── .gitignore
├── .editorconfig
├── package.json                       # root workspaces config
└── README.md
```

---

## 6. Design System & Theming

The existing HTML prototype defines the exact visual identity of the app. The coding agent **MUST** reproduce these design tokens precisely via an MUI theme — do not invent new colours, radii, or spacing. Implement this as `apps/frontend/src/theme/theme.ts` and `apps/frontend/src/theme/tokens.ts`.

### 6.1 Colour Palette

| Token | Hex | Usage |
|---|---|---|
| Primary (green) | `#1B6B3A` | Top bar, primary buttons, FAB, active states |
| Primary light | `#E8F5EE` | Selected menu cells, login icon background, chips |
| Primary mid | `#2D8A4E` | Secondary accents, stat values |
| Primary dark | `#124D29` | Pressed/active button states, gradients |
| Amber | `#D97706` | Pack badge, Pending payment accents |
| Amber light | `#FEF3C7` | Pack badge background |
| Red | `#DC2626` | Pending payment badge, delete buttons, errors |
| Red light | `#FEE2E2` | Pending badge background, error backgrounds |
| Blue | `#1D4ED8` | Dine-in badge text |
| Blue light | `#EFF6FF` | Dine-in badge background |
| Page background | `#F0F4F1` | Overall app background |
| Surface (paper) | `#FFFFFF` | Cards, modals, top-of-stack surfaces |
| Grey 50–900 | `#F9FAFB` → `#111827` | Standard MUI grey scale, see 6.2 |

### 6.2 Grey Scale

```ts
grey: {
  50:  '#F9FAFB', 100: '#F3F4F6', 200: '#E5E7EB', 300: '#D1D5DB',
  400: '#9CA3AF', 500: '#6B7280', 600: '#4B5563', 700: '#374151',
  800: '#1F2937', 900: '#111827',
}
```

### 6.3 Status / Badge Colour Tokens

Define in `apps/frontend/src/theme/tokens.ts`:

```ts
export const statusColors = {
  dineIn:    { bg: '#EFF6FF', fg: '#1D4ED8', label: '🍽 Dine in' },
  pack:      { bg: '#FEF3C7', fg: '#D97706', label: '📦 Pack' },
  cash:      { bg: '#D1FAE5', fg: '#065F46', label: '💵 Cash' },
  upi:       { bg: '#EDE9FE', fg: '#5B21B6', label: '📱 UPI' },
  pending:   { bg: '#FEE2E2', fg: '#DC2626', label: '⏳ Pending' },
  completed: { bg: '#F3F4F6', fg: '#6B7280', label: '✓ Done' },
};
```

### 6.4 Shape, Spacing & Shadows

| Token | Value | MUI mapping |
|---|---|---|
| Radius — small | `8px` | Buttons, inputs (shape.borderRadius base unit) |
| Radius — medium | `12px` | Stat chips, config buttons, FAB inner elements |
| Radius — large | `16px` | Cards (MuiCard override) |
| Radius — extra large | `20px` | Login card, modals/bottom sheets |
| Shadow — small | `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)` | Cards at rest |
| Shadow — medium | `0 4px 12px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.06)` | FAB, raised elements |
| Shadow — large | `0 10px 30px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.08)` | Login card, modals |

### 6.5 Typography

- Font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` (do not load a custom web font — keeps the bundle light and matches native rendering on iOS/Android).
- Base font size: `15px` body text.
- Headings and totals use `font-weight 700–800` with slightly tightened `letter-spacing` (`-0.2px` to `-0.5px`) for a crisp, modern feel.
- Buttons use `font-weight: 600` and `textTransform: "none"` (no uppercase — MUI default uppercase must be disabled).

### 6.6 MUI Theme Implementation

`apps/frontend/src/theme/theme.ts` must export a theme created via `createTheme()` with at least the following configuration:

```ts
import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1B6B3A',
      light: '#E8F5EE',
      dark: '#124D29',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#D97706',
      light: '#FEF3C7',
      contrastText: '#FFFFFF',
    },
    error:   { main: '#DC2626', light: '#FEE2E2' },
    info:    { main: '#1D4ED8', light: '#EFF6FF' },
    success: { main: '#2D8A4E', light: '#D1FAE5' },
    background: { default: '#F0F4F1', paper: '#FFFFFF' },
    grey: {
      50: '#F9FAFB', 100: '#F3F4F6', 200: '#E5E7EB', 300: '#D1D5DB',
      400: '#9CA3AF', 500: '#6B7280', 600: '#4B5563', 700: '#374151',
      800: '#1F2937', 900: '#111827',
    },
    text: { primary: '#111827', secondary: '#6B7280' },
  },
  typography: {
    fontFamily: [
      '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif',
    ].join(','),
    fontSize: 14,
    button: { fontWeight: 600, textTransform: 'none' },
    h1: { fontWeight: 800, letterSpacing: '-0.5px' },
    h2: { fontWeight: 700, letterSpacing: '-0.3px' },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, fontWeight: 600 },
        containedPrimary: {
          '&:active': { backgroundColor: '#124D29', transform: 'scale(0.97)' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        },
      },
    },
    MuiChip: {
      styleOverrides: { root: { borderRadius: 20, fontWeight: 600 } },
    },
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
  },
});
```

### 6.7 Animation Requirements

| Element | Animation | Approx. duration |
|---|---|---|
| Screen/route transitions | Fade + slight upward translate on mount | 250ms ease |
| Login card | Pop-in (scale 0.92 → 1, slight overshoot) | 350ms cubic-bezier(0.34,1.56,0.64,1) |
| PIN error | Horizontal shake on the PIN dot row | 400ms ease |
| New order card appearing in Day View | Slide-up + fade | 250ms ease |
| Payment modal / bottom sheet | Slide up from bottom + dim overlay fade-in | 250ms ease |
| Button / chip press | Scale down to ~0.93–0.97 on press | 120ms |

> ⚠ Implement animations with MUI's built-in transition components (`Fade`, `Slide`, `Grow`, `Collapse`) and CSS keyframes via the theme's `sx` prop / `styled` API — avoid adding a separate animation library to keep the bundle light.

---

## 7. PWA Requirements

### 7.1 Web App Manifest

Configure via `vite-plugin-pwa` in `apps/frontend/vite.config.ts`. The generated `manifest.webmanifest` must include:

```json
{
  "name": "Millets Momo - Order Tracker",
  "short_name": "Millets Momo",
  "description": "Daily order tracking for the Millets Momo cart",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#F0F4F1",
  "theme_color": "#1B6B3A",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### 7.2 iOS-Specific Requirements

`apps/frontend/index.html` **MUST** also include:

```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="Millets Momo" />
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
<meta name="theme-color" content="#1B6B3A" />
```

### 7.3 Service Worker / Offline Behaviour

- Use `vite-plugin-pwa` with `strategy: "generateSW"` and `registerType: "autoUpdate"`.
- Precache the app shell (HTML, JS, CSS, icons, fonts) so the login screen and static UI load offline.
- Runtime caching: `GET /api/menu` uses a "CacheFirst" strategy with a long expiry (menu rarely changes); `GET /api/orders` and `GET /api/admin/summary` use "NetworkFirst" with a short cache fallback.
- Do **not** cache POST/PATCH/DELETE requests — show a clear "You are offline, please reconnect" message if a mutation fails due to network error.

### 7.4 Installability Checklist

1. App is served over HTTPS (provided automatically by Azure Static Web Apps).
2. Valid manifest with `name`, icons (192px and 512px minimum), `start_url`, and `display: "standalone"`.
3. Registered service worker with a fetch handler.
4. Verified installable via Lighthouse PWA audit (target score ≥ 90) and manually tested: "Add to Home Screen" on iOS Safari, and "Install app" on Android Chrome.

---

## 8. Data Model & Database Schema (Azure SQL / T-SQL)

Save the following as `apps/backend/src/db/schema.sql`. All queries against these tables **MUST** use parameterized statements via the `mssql` package — **never string concatenation**.

### 8.1 Users Table

```sql
CREATE TABLE Users (
  id           INT IDENTITY(1,1) PRIMARY KEY,
  username     NVARCHAR(50)  NOT NULL UNIQUE,
  role         NVARCHAR(20)  NOT NULL CHECK (role IN ('staff','admin')),
  pin_hash     NVARCHAR(255) NOT NULL,
  display_name NVARCHAR(100) NOT NULL,
  is_active    BIT           NOT NULL DEFAULT 1,
  created_at   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
```

### 8.2 MenuItems Table

```sql
CREATE TABLE MenuItems (
  id           INT IDENTITY(1,1) PRIMARY KEY,
  filling      NVARCHAR(30)  NOT NULL,
  preparation  NVARCHAR(30)  NOT NULL,
  display_name NVARCHAR(60)  NOT NULL,
  full_price   DECIMAL(6,2)  NOT NULL,
  half_price   DECIMAL(6,2)  NOT NULL,
  is_active    BIT           NOT NULL DEFAULT 1,
  CONSTRAINT UQ_MenuItems_Combo UNIQUE (filling, preparation)
);
```

### 8.3 Orders Table

```sql
CREATE TABLE Orders (
  id              BIGINT        NOT NULL PRIMARY KEY,  -- epoch ms, generated by backend
  order_date      DATE          NOT NULL,              -- the selected business date (YYYY-MM-DD)
  time_label      NVARCHAR(20)  NOT NULL,              -- e.g. '02:45 PM' (Asia/Kolkata)
  order_type      NVARCHAR(10)  NOT NULL CHECK (order_type IN ('dine','pack')),
  payment_method  NVARCHAR(10)  NOT NULL CHECK (payment_method IN ('cash','upi','pending')),
  is_completed    BIT           NOT NULL DEFAULT 0,
  total_amount    DECIMAL(8,2)  NOT NULL,
  created_by      INT           NULL REFERENCES Users(id),
  created_at      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
  completed_at    DATETIME2     NULL
);

CREATE INDEX IX_Orders_OrderDate  ON Orders(order_date);
CREATE INDEX IX_Orders_Completed  ON Orders(order_date, is_completed);
```

### 8.4 OrderItems Table

```sql
CREATE TABLE OrderItems (
  id            INT     IDENTITY(1,1) PRIMARY KEY,
  order_id      BIGINT  NOT NULL REFERENCES Orders(id) ON DELETE CASCADE,
  menu_item_id  INT     NOT NULL REFERENCES MenuItems(id),
  item_name     NVARCHAR(60)  NOT NULL,  -- denormalised snapshot, e.g. 'Veg Steam'
  quantity      INT     NOT NULL CHECK (quantity > 0),
  is_half       BIT     NOT NULL DEFAULT 0,
  unit_price    DECIMAL(6,2)  NOT NULL,  -- price actually charged (full or half)
  line_total    DECIMAL(8,2)  NOT NULL   -- unit_price * quantity
);

CREATE INDEX IX_OrderItems_OrderId ON OrderItems(order_id);
```

> ⚠ `item_name` and `unit_price` are denormalised onto `OrderItems` because menu prices may change in the future, but historical orders must always reflect the price actually charged on the day. Never recompute historical totals from the live `MenuItems` table.

---

## 9. Menu & Pricing Reference Data

The menu consists of exactly 24 fixed items: 6 preparation styles × 4 fillings. Display name = `"{Filling} {Preparation}"` (e.g. "Veg Steam", "Platter Pan Fried"). All prices below are taken from the business's printed menu card and were verified with the business owner.

### 9.1 Full-Plate Price Grid (₹)

| Preparation \ Filling | Veg | Paneer | Cheese Corn | Platter |
|---|---|---|---|---|
| Steam | 89 | 109 | 129 | 109 |
| Fry | 109 | 129 | 149 | 129 |
| Creamy | 129 | 129 | 149 | 129 |
| Creamy Fry | 129 | 149 | 169 | 149 |
| Nep. Kothey | 129 | 139 | 149 | 139 |
| Pan Fried | 139 | 149 | 159 | 149 |

### 9.2 Half-Plate Price Grid (₹)

| Preparation \ Filling | Veg | Paneer | Cheese Corn | Platter |
|---|---|---|---|---|
| Steam | 50 | 60 | 70 | 60 |
| Fry | 60 | 70 | 80 | 70 |
| Creamy | 60 | 70 | 80 | 70 |
| Creamy Fry | 70 | 80 | 90 | 80 |
| Nep. Kothey | 70 | 75 | 80 | 75 |
| Pan Fried | 75 | 80 | 85 | 80 |

**Sourcing notes:**

- Steam, Fry, Creamy, and Creamy Fry half prices are printed directly on the menu card for Veg, Paneer, and Cheese Corn; the Platter column for these four rows is copied from the Paneer column (confirmed with the business — Platter is priced the same as Paneer where not separately listed).
- Nep. Kothey and Pan Fried have no printed half-plate price. These were computed using the formula `round((fullPrice + 11) / 2)`, confirmed with the business as the standard rule.

### 9.3 Half-Plate Pricing Formula (Fallback Rule)

For any future menu item added without an explicit half price:

```
halfPrice = Math.round((fullPrice + 11) / 2)
```

This is implemented in `packages/shared/src/pricing.ts` as `computeHalfPrice()` but is **NOT** used to derive the 24 stored values in Section 9.2 — those are fixed, verified values seeded directly into `MenuItems.half_price`.

| Full Price (₹) | Half Price via formula (₹) | Calculation |
|---|---|---|
| 89 | 50 | round((89+11)/2) = 50 |
| 109 | 60 | round((109+11)/2) = 60 |
| 129 | 70 | round((129+11)/2) = 70 |
| 139 | 75 | round((139+11)/2) = 75 |
| 149 | 80 | round((149+11)/2) = 80 |
| 159 | 85 | round((159+11)/2) = 85 |
| 169 | 90 | round((169+11)/2) = 90 |

### 9.4 Canonical Menu Definition (TypeScript)

Implement in `packages/shared/src/menu.ts`:

```ts
export const FILLINGS = ['Veg', 'Paneer', 'Cheese Corn', 'Platter'] as const;
export const PREPARATIONS = [
  'Steam', 'Fry', 'Creamy', 'Creamy Fry', 'Nep. Kothey', 'Pan Fried',
] as const;

// FULL_PRICES[prepIndex][fillingIndex] = full plate price in INR
// Source: printed Millets Momo menu card (verified with business owner).
// Platter (Steam/Fry/Creamy/Creamy Fry) is priced the same as Paneer.
export const FULL_PRICES: number[][] = [
  [89,  109, 129, 109],  // Steam
  [109, 129, 149, 129],  // Fry
  [129, 129, 149, 129],  // Creamy
  [129, 149, 169, 149],  // Creamy Fry
  [129, 139, 149, 139],  // Nep. Kothey
  [139, 149, 159, 149],  // Pan Fried
];

// HALF_PRICES[prepIndex][fillingIndex] = half plate price in INR
// Steam/Fry/Creamy/Creamy Fry: printed on menu (Platter copied from Paneer).
// Nep. Kothey / Pan Fried: computed via round((full + 11) / 2).
export const HALF_PRICES: number[][] = [
  [50, 60, 70, 60],  // Steam
  [60, 70, 80, 70],  // Fry
  [60, 70, 80, 70],  // Creamy
  [70, 80, 90, 80],  // Creamy Fry
  [70, 75, 80, 75],  // Nep. Kothey
  [75, 80, 85, 80],  // Pan Fried
];

export interface MenuItem {
  filling: string;
  preparation: string;
  displayName: string;   // "{Filling} {Preparation}"
  fullPrice: number;
  halfPrice: number;
}

export function buildMenu(): MenuItem[] {
  const items: MenuItem[] = [];
  PREPARATIONS.forEach((prep, pi) => {
    FILLINGS.forEach((fill, fi) => {
      items.push({
        filling: fill,
        preparation: prep,
        displayName: `${fill} ${prep}`,
        fullPrice: FULL_PRICES[pi][fi],
        halfPrice: HALF_PRICES[pi][fi],
      });
    });
  });
  return items; // 24 items
}

/** Fallback rule for any future item with no explicit half price (Section 9.3). */
export function computeHalfPrice(fullPrice: number): number {
  return Math.round((fullPrice + 11) / 2);
}
```

### 9.5 Seed Data (seed.sql)

Append to `apps/backend/src/db/seed.sql` — 24 menu item rows, then the two user accounts:

```sql
-- Menu items (24 rows)
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Veg', 'Steam', 'Veg Steam', 89.00, 50.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Paneer', 'Steam', 'Paneer Steam', 109.00, 60.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Cheese Corn', 'Steam', 'Cheese Corn Steam', 129.00, 70.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Platter', 'Steam', 'Platter Steam', 109.00, 60.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Veg', 'Fry', 'Veg Fry', 109.00, 60.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Paneer', 'Fry', 'Paneer Fry', 129.00, 70.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Cheese Corn', 'Fry', 'Cheese Corn Fry', 149.00, 80.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Platter', 'Fry', 'Platter Fry', 129.00, 70.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Veg', 'Creamy', 'Veg Creamy', 129.00, 60.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Paneer', 'Creamy', 'Paneer Creamy', 129.00, 70.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Cheese Corn', 'Creamy', 'Cheese Corn Creamy', 149.00, 80.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Platter', 'Creamy', 'Platter Creamy', 129.00, 70.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Veg', 'Creamy Fry', 'Veg Creamy Fry', 129.00, 70.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Paneer', 'Creamy Fry', 'Paneer Creamy Fry', 149.00, 80.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Cheese Corn', 'Creamy Fry', 'Cheese Corn Creamy Fry', 169.00, 90.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Platter', 'Creamy Fry', 'Platter Creamy Fry', 149.00, 80.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Veg', 'Nep. Kothey', 'Veg Nep. Kothey', 129.00, 70.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Paneer', 'Nep. Kothey', 'Paneer Nep. Kothey', 139.00, 75.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Cheese Corn', 'Nep. Kothey', 'Cheese Corn Nep. Kothey', 149.00, 80.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Platter', 'Nep. Kothey', 'Platter Nep. Kothey', 139.00, 75.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Veg', 'Pan Fried', 'Veg Pan Fried', 139.00, 75.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Paneer', 'Pan Fried', 'Paneer Pan Fried', 149.00, 80.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Cheese Corn', 'Pan Fried', 'Cheese Corn Pan Fried', 159.00, 85.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Platter', 'Pan Fried', 'Platter Pan Fried', 149.00, 80.00);

-- User accounts
-- Run scripts/generatePinHash.ts with the desired 4-digit PIN to obtain a bcrypt hash,
-- then substitute the hashes below before running this seed.
INSERT INTO Users (username, role, pin_hash, display_name) VALUES
  ('staff', 'staff', '<BCRYPT_HASH_OF_STAFF_PIN>', 'Cart Staff'),
  ('admin', 'admin', '<BCRYPT_HASH_OF_ADMIN_PIN>', 'Owner');
```

---

## 10. Business Logic & Rules

### 10.1 Order Identification & Timing

- **Order ID:** generated by the backend at submission time as `Date.now()` (epoch milliseconds, BIGINT). Unique and naturally sortable.
- **time_label:** formatted as `"hh:mm AM/PM"` in the Asia/Kolkata timezone, e.g. `"02:45 PM"`, generated server-side at submission time and stored verbatim.
- **order_date:** the business date the staff member selected on the Date Select screen (not necessarily "today"). Stored as a SQL `DATE` (YYYY-MM-DD), no time component.

### 10.2 Order Totals

- Each `OrderItem.line_total` = `unitPrice × quantity`, where `unitPrice` is `fullPrice` or `halfPrice` from the canonical menu depending on `isHalf`.
- `Order.total_amount` = sum of all its `OrderItems.line_total`.
- The frontend computes and displays the running total live as items are added/adjusted (for instant customer quoting).
- On `POST /api/orders`, the backend **MUST** recompute `unitPrice`, `lineTotal`, and `totalAmount` from the canonical menu, ignoring any totals sent by the client. Server values are authoritative.

### 10.3 Order Type & Payment Method

- `order_type`: `"dine"` (default, label "🍽 Dine in") or `"pack"` (label "📦 Pack").
- `payment_method`: `"cash"` (default, label "💵 Cash"), `"upi"` (label "📱 UPI"), or `"pending"` (label "⏳ Pending").

### 10.4 Order Completion & the Pending-Payment Modal

1. Staff taps "✓ Done" on an order card.
2. Frontend checks the order's current `payment_method`.
3. If `payment_method !== "pending"`: call `PATCH /api/orders/:id/complete` with empty body `{}`. Backend sets `is_completed = 1` and `completed_at = now`.
4. If `payment_method === "pending"`: frontend shows a bottom-sheet `PaymentModal` titled "Collect Payment" with message "This order was pending. How did the customer pay?" and two buttons: "💵 Cash" and "📱 UPI", plus a "Cancel" button.
5. On choosing Cash or UPI: call `PATCH /api/orders/:id/complete` with body `{ paymentMethod: "cash" | "upi" }`. Backend updates `payment_method`, sets `is_completed = 1` and `completed_at = now` in a single transaction.
6. After completion, the order card moves from "Active orders" to the "Completed" section.

### 10.5 Day View Grouping & Stats

- **Active orders** = orders where `is_completed = 0`, shown first under "Active orders (N)".
- **Completed orders** = orders where `is_completed = 1`, shown below a horizontal divider labelled "Completed (N)".
- **Stat chips:** "Orders" = total count; "Revenue" = sum of `total_amount` for ALL orders (active + completed); "Pending" = sum of `total_amount` for orders where `payment_method = "pending"`.

### 10.6 Order Deletion

Deleting an order (`DELETE /api/orders/:id`) permanently removes the order and cascades to its items. The frontend **MUST** show a confirmation dialog ("Remove this order?") before calling the API. No undo is provided.

### 10.7 Validation Rules

| Field / Action | Rule |
|---|---|
| PIN entry | Exactly 4 digits (0-9). Auto-submits when the 4th digit is entered. |
| Date selection | Must be a valid date; defaults to today (Asia/Kolkata) on first load. |
| New order submission | At least one menu item with quantity ≥ 1 must be selected. Submit button is disabled otherwise. |
| Quantity | Integer ≥ 0. Decrementing to 0 removes the item from the order. |
| Order type | Must be one of `"dine"` \| `"pack"`. |
| Payment method | Must be one of `"cash"` \| `"upi"` \| `"pending"`. |
| Complete with pending payment | `paymentMethod` in the completion request, when required, must be `"cash"` or `"upi"` — `"pending"` is rejected with 400. |

---

## 11. API Specification

**Base path:** `/api`. All endpoints except `/api/auth/login` and `/api/health` require a valid JWT in the `Authorization` header. All request/response bodies are JSON.

### 11.1 Endpoint Summary

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | None | Liveness check, returns `{ status: "ok" }` |
| POST | `/api/auth/login` | None | Authenticate via role + PIN, returns JWT |
| GET | `/api/menu` | Staff or Admin | Returns the 24-item menu with full/half prices |
| GET | `/api/orders?date=` | Staff or Admin | List all orders (with items) for a date |
| POST | `/api/orders` | Staff or Admin | Create a new order |
| PATCH | `/api/orders/:id/complete` | Staff or Admin | Mark an order complete (optional payment update) |
| DELETE | `/api/orders/:id` | Staff or Admin | Delete an order |
| GET | `/api/admin/summary?date=` | Admin only | Daily summary stats + item breakdown |

### 11.2 POST /api/auth/login

**Request:**
```json
{
  "role": "staff",
  "pin": "1234"
}
```

**Success (200):**
```json
{
  "token": "<jwt>",
  "role": "staff",
  "displayName": "Cart Staff",
  "expiresIn": 43200
}
```

**Error (401):**
```json
{ "error": "Invalid PIN" }
```

> ⚠ Rate-limited to 5 attempts per 15 minutes per IP.

### 11.3 GET /api/menu

**Success (200):**
```json
{
  "items": [
    { "id": 1, "filling": "Veg", "preparation": "Steam", "displayName": "Veg Steam", "fullPrice": 89, "halfPrice": 50 },
    { "id": 2, "filling": "Paneer", "preparation": "Steam", "displayName": "Paneer Steam", "fullPrice": 109, "halfPrice": 60 }
  ]
}
```

### 11.4 GET /api/orders?date=YYYY-MM-DD

**Success (200):**
```json
{
  "date": "2026-06-17",
  "orders": [
    {
      "id": 1749812345678,
      "orderDate": "2026-06-17",
      "timeLabel": "02:45 PM",
      "orderType": "dine",
      "paymentMethod": "cash",
      "isCompleted": false,
      "totalAmount": 248,
      "items": [
        { "menuItemId": 1, "itemName": "Veg Steam", "quantity": 2, "isHalf": false, "unitPrice": 89, "lineTotal": 178 },
        { "menuItemId": 9, "itemName": "Paneer Creamy", "quantity": 1, "isHalf": true, "unitPrice": 70, "lineTotal": 70 }
      ]
    }
  ]
}
```

### 11.5 POST /api/orders

**Request:**
```json
{
  "orderDate": "2026-06-17",
  "orderType": "dine",
  "paymentMethod": "cash",
  "items": [
    { "menuItemId": 1, "quantity": 2, "isHalf": false },
    { "menuItemId": 9, "quantity": 1, "isHalf": true }
  ]
}
```

Server recomputes `unitPrice`, `lineTotal`, and `totalAmount` from canonical menu. Returns 201 with the created order object.

### 11.6 PATCH /api/orders/:id/complete

**Request (non-pending order):**
```json
{}
```

**Request (pending order — `paymentMethod` required):**
```json
{ "paymentMethod": "cash" }
```

Returns 200 with the updated order. Returns 400 if `paymentMethod` is required but missing/invalid.

### 11.7 DELETE /api/orders/:id

**Success (200):**
```json
{ "deleted": true, "id": 1749812345678 }
```

Returns 404 if the order does not exist.

### 11.8 GET /api/admin/summary?date=YYYY-MM-DD

**Success (200):**
```json
{
  "date": "2026-06-17",
  "totalOrders": 18,
  "totalRevenue": 4280,
  "pendingAmount": 240,
  "cashTotal": 3120,
  "upiTotal": 920,
  "itemBreakdown": [
    { "itemName": "Veg Steam", "totalQuantity": 14, "totalRevenue": 1246 },
    { "itemName": "Paneer Creamy Fry", "totalQuantity": 9, "totalRevenue": 1341 }
  ],
  "orders": [ /* same shape as 11.4 */ ]
}
```

### 11.9 Error Response Convention

All errors return `{ "error": "<message>" }` with the appropriate HTTP status: 400 (validation), 401 (auth), 403 (wrong role), 404 (not found), 429 (rate limited), 500 (server error — no stack traces in production).

---

## 12. Frontend Specification

### 12.1 Routes

| Path | Page Component | Access | Description |
|---|---|---|---|
| `/login` | `LoginPage` | Public | Role tabs (Staff/Admin) + PIN pad |
| `/dates` | `DateSelectPage` | Staff | Date picker + quick-select + recent days |
| `/day/:date` | `DayViewPage` | Staff | Active/completed order cards for a date |
| `/day/:date/new` | `NewOrderPage` | Staff | Menu grid + order config + summary + submit |
| `/admin` | `AdminDashboardPage` | Admin | Date picker + summary cards + item breakdown + orders list |

- `ProtectedRoute` wraps Staff/Admin routes: checks `AuthContext` for a valid token + matching role; redirects to `/login` if absent/invalid.
- Root `/` redirects to `/login` if unauthenticated, or to `/dates` (staff) / `/admin` (admin) if already authenticated.

### 12.2 Key Components

| Component | Responsibility |
|---|---|
| `PinPad` | 4-dot PIN display + numeric keypad (1-9, 0, delete, enter); shake animation on wrong PIN; role tabs "Staff"/"Admin" above it. |
| `MenuGrid` | 6 (preparations) × 4 (fillings) tap-grid. Click = add 1 / increment. Long-press (500ms touch) or right-click (desktop) = toggle half-plate. Shows quantity badge and "½ plate" tag. |
| `OrderConfigPanel` | Two button-groups: Order Type (Dine in / Pack) and Payment (Cash / UPI / Pending), single-select, default Dine in + Cash. |
| `SelectedItemsList` | Lists each chosen item with name, Full/Half toggle chip, qty +/- buttons, and line total; shows "No items added yet" when empty. |
| `TotalBar` | Sticky bottom bar showing live total (₹) and the "Place order" button (disabled until ≥1 item selected). |
| `OrderCard` | Renders one order: time label, type badge, payment badge, item list, total, and action buttons ("✓ Done" / "✕" delete) or a done status badge if completed. |
| `PaymentModal` | Bottom-sheet modal for resolving a pending payment on completion (Section 10.4). |
| `StatChip` | Small rounded card showing a label + value, used for Orders/Revenue/Pending stats. |
| `Toast` | Transient bottom toast for confirmations ("Order placed! 🎉", "Order removed", "½ plate set", etc.). |

### 12.3 State Management

- **`AuthContext`:** holds `{ token, role, displayName }`, persisted to `sessionStorage`; axios interceptor attaches the token and triggers `logout()` on 401.
- **`OrderDraftContext`** (or local state within `NewOrderPage`): holds the in-progress order — items map keyed by `menuItemId` → `{ quantity, isHalf }`, `orderType`, `paymentMethod`. Cleared on cancel or submit.
- **Server state** managed via `@tanstack/react-query`: `useMenu()`, `useOrders(date)`, `useAdminSummary(date)`, with mutations that invalidate the relevant query on success.

### 12.4 Responsive Behaviour

| Breakpoint | Width | Layout notes |
|---|---|---|
| xs (phone) | < 600px | Single column; menu grid scrolls horizontally if needed; full-width cards; FAB visible. |
| sm/md (tablet) | 600–1023px | Content max-width ~600–700px centred; admin summary cards in 2-column grid. |
| lg+ (desktop) | ≥ 1024px | Content max-width ~960px centred; admin summary cards in 4-column grid; menu grid at full size. |

---

## 13. Authentication & Security Requirements

Security is a first-class requirement. All of the following **MUST** be implemented.

### 13.1 PIN Storage & Verification

- PINs are never stored or transmitted in plaintext at rest. Only bcrypt hashes (cost factor 10) are stored in `Users.pin_hash`.
- `apps/backend/scripts/generatePinHash.ts` is a CLI (`node generatePinHash.ts <pin>`) that prints a bcrypt hash for use in `seed.sql`.
- Login compares the submitted PIN using `bcrypt.compare` — never simple string equality.

### 13.2 JWT Sessions

- Sign a JWT with `jsonwebtoken` using `process.env.JWT_SECRET`, payload `{ sub: userId, role, displayName }`, expiry 12h.
- `authMiddleware.ts` verifies the token on every protected route and returns 401 on missing/invalid/expired tokens.
- `requireRole('admin')` middleware guards `/api/admin/*` routes and returns 403 for non-admin tokens.

### 13.3 Express Middleware Stack (in order)

1. `helmet()` — sets secure HTTP headers (CSP, X-Content-Type-Options, X-Frame-Options: DENY, HSTS, etc.).
2. `cors({ origin: process.env.ALLOWED_ORIGIN, credentials: true })` — restrict to deployed frontend origin only; **no wildcard `"*"` in production**.
3. `express.json({ limit: '50kb' })` — small body size limit.
4. `express-rate-limit` on `/api/auth/login`: 5 requests per 15 minutes per IP.
5. Request logging via `morgan` — **MUST NOT log request bodies or Authorization headers** (to avoid logging PINs).
6. Centralised `errorHandler.ts` — **NEVER includes stack traces in production responses**.

### 13.4 SQL Injection Prevention

All database access goes through `apps/backend/src/db/pool.ts`. Every query **MUST** use `request.input()` placeholders — string concatenation into SQL text is **strictly forbidden**.

```ts
const request = pool.request();
request.input('orderDate', sql.Date, orderDate);
const result = await request.query(
  'SELECT * FROM Orders WHERE order_date = @orderDate ORDER BY id DESC'
);
```

### 13.5 Input Validation (zod)

Every request body and relevant query parameter is validated with a zod schema in `apps/backend/src/validators/` before reaching the controller logic. Invalid input returns 400.

### 13.6 XSS Prevention

- React escapes all rendered text by default — `dangerouslySetInnerHTML` **MUST NOT** be used anywhere.
- Helmet's CSP header further mitigates injected-script risks.

### 13.7 Transport Security

Azure Static Web Apps and Azure Functions provide HTTPS by default with automatically managed certificates. No manual certificate management is required.

### 13.8 Secrets Management

No secrets (JWT secret, DB credentials, PIN hashes) are ever committed to the repository. `local.settings.example.json` documents the required keys with placeholder values; the real `local.settings.json` is gitignored. In production, all secrets are configured as Application Settings on the Azure resource.

---

## 14. Testing Requirements

### 14.1 Backend (Jest + Supertest + ts-jest)

Location: `apps/backend/tests/`. Run via `npm run test` in `apps/backend`.

| Test file | Coverage |
|---|---|
| `pricing.test.ts` | `buildMenu()` returns exactly 24 items with `fullPrice`/`halfPrice` matching Sections 9.1 and 9.2; `computeHalfPrice()` formula matches Section 9.3 examples. |
| `auth.test.ts` | Correct PIN → 200 + valid JWT; wrong PIN → 401; missing fields → 400; rate limiting after 5 failed attempts → 429. |
| `menu.test.ts` | Requires auth (401 without token); returns 24 items with correct full/half prices. |
| `orders.test.ts` | POST creates order + items with server-recomputed totals; rejects empty items (400); rejects unknown `menuItemId` (400). GET returns correct shape for date. PATCH completes non-pending order; rejects pending without `paymentMethod` (400); updates `payment_method` when provided. DELETE removes order + cascades; 404 for unknown id. |
| `admin.test.ts` | Requires admin role (403 for staff token); aggregates totals, cash/upi splits, pending amount, and `itemBreakdown` sorted by quantity correctly. |

Target: ≥80% statement coverage on `src/services` and `src/utils`.

### 14.2 Frontend (Vitest + React Testing Library)

Location: `apps/frontend/tests/`. Run via `npm run test` in `apps/frontend`.

| Test file | Coverage |
|---|---|
| `pricing.test.ts` | Menu items match fixed full/half price grids; order total calculation sums correctly for mixed full/half items. |
| `PinPad.test.tsx` | Renders 4 empty dots; typing 4 digits fills all dots and triggers `onComplete`; wrong PIN triggers shake/error and resets. |
| `MenuGrid.test.tsx` | Renders 24 cells with correct display names; clicking increments quantity and shows count badge; long-press/right-click toggles half-plate. |
| `TotalBar.test.tsx` | Displays "₹0" and disabled submit with no items; updates total and enables submit when items are added. |
| `OrderCard.test.tsx` | Renders correct badges for each `orderType`/`paymentMethod` combination; shows "(½)" for half items; shows done styling when completed. |
| `PaymentModal.test.tsx` | Renders only for pending payment completion; Cash/UPI buttons call `onResolve` with correct value; Cancel dismisses without calling `onResolve`. |

Mock all API calls with msw or vitest mocks — no real network calls in unit tests.

Run both workspaces' tests from the root: `npm run test --workspaces`.

---

## 15. Deployment & DevOps Plan

### 15.1 Azure Resources Required

| Resource | Tier / Plan | Notes |
|---|---|---|
| Resource Group | N/A | e.g. `rg-millets-momo` |
| Azure SQL logical server | N/A | Allow Azure services access (firewall rule) |
| Azure SQL Database | **Free offer tier** (serverless) | **CRITICAL: must explicitly pick the Free offer at creation — it is not the default.** 100,000 vCore-seconds + 32GB storage/month, free indefinitely. |
| Azure Static Web App | Free plan | Hosts built frontend AND managed Azure Functions for `/api/*` |

### 15.2 Step-by-Step Setup

1. Create resource group: `az group create --name rg-millets-momo --location centralindia`
2. Create SQL logical server: `az sql server create --name <server-name> --resource-group rg-millets-momo --location centralindia --admin-user <admin> --admin-password <strong-password>`
3. Allow Azure services to connect: `az sql server firewall-rule create --resource-group rg-millets-momo --server <server-name> --name AllowAzureServices --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0`
4. Create the database via Azure Portal — on "Compute + storage", explicitly select the **"Free offer"** pricing tier before creating.
5. Run `schema.sql` and `seed.sql` against the new database (via `npm run db:migrate` or the Portal Query Editor).
6. Create the Static Web App, linking it to the GitHub repo, with: `app_location = apps/frontend`, `output_location = dist`, `api_location = apps/backend`.
7. Set Application Settings: `SQL_SERVER`, `SQL_DATABASE`, `SQL_USER`, `SQL_PASSWORD`, `JWT_SECRET`, `ALLOWED_ORIGIN`.
8. Push to the configured branch — GitHub Actions builds and deploys both frontend and API automatically.
9. Verify: open the SWA URL on a phone, confirm HTTPS, log in as Staff and Admin, place a test order, and confirm PWA installability on iOS and Android.

### 15.3 GitHub Actions Workflow

`.github/workflows/azure-deploy.yml` uses the official `Azure/static-web-apps-deploy` action with `app_location: "apps/frontend"`, `api_location: "apps/backend"`, `output_location: "dist"`, and the deployment token stored as `AZURE_STATIC_WEB_APPS_API_TOKEN`. Pull requests create a temporary staging environment; merge to `main` deploys to production.

### 15.4 Database Migration Script

`apps/backend/scripts/migrate.ts` connects using the same env vars as the runtime, reads `schema.sql` and `seed.sql`, and executes them in order (idempotent where appropriate). Exposed as `npm run db:migrate`.

---

## 16. Environment Variables & Configuration

### 16.1 Backend (`apps/backend/local.settings.example.json`)

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "",
    "NODE_ENV": "development",

    "SQL_SERVER": "<server-name>.database.windows.net",
    "SQL_DATABASE": "millets-momo-db",
    "SQL_USER": "<admin-username>",
    "SQL_PASSWORD": "<admin-password>",
    "SQL_ENCRYPT": "true",

    "JWT_SECRET": "<random-long-secret-string>",
    "JWT_EXPIRY": "12h",

    "ALLOWED_ORIGIN": "http://localhost:5173"
  }
}
```

### 16.2 Frontend (`apps/frontend/.env.example`)

```
VITE_API_BASE_URL=http://localhost:7071/api
```

### 16.3 Variable Reference

| Variable | Where | Description |
|---|---|---|
| `SQL_SERVER` / `SQL_DATABASE` / `SQL_USER` / `SQL_PASSWORD` | Backend | Azure SQL connection details |
| `SQL_ENCRYPT` | Backend | Must be `"true"` — Azure SQL requires encrypted connections |
| `JWT_SECRET` | Backend | Signing secret for session JWTs |
| `JWT_EXPIRY` | Backend | Token lifetime, default `"12h"` |
| `ALLOWED_ORIGIN` | Backend | CORS allow-list — the deployed frontend URL |
| `VITE_API_BASE_URL` | Frontend | Base URL for API calls; same-origin `"/api"` in production |

---

## 17. README Requirements

The root `README.md` **MUST** contain the following sections in this order:

1. Project title, one-paragraph description, and a "Built with" tech list.
2. Features — bullet list mirroring Section 2.1.
3. Tech stack table (reuse Section 4).
4. Monorepo structure — abbreviated version of the tree in Section 5.
5. Prerequisites — Node.js 20+, npm, an Azure SQL Database (or local SQL Server) for development.
6. Local setup — step-by-step: clone, `npm install`, copy `.env.example` / `local.settings.example.json`, fill in values, `npm run db:migrate`, `npm run dev`.
7. Default accounts — explains that Staff and Admin PINs are set via the seed/migration step (Section 9.5 / 16) and how to generate new PIN hashes with `scripts/generatePinHash.ts`.
8. Build & test — `npm run build`, `npm run test`, `npm run lint` commands.
9. Deployment — summary + link to `docs/DEPLOYMENT.md`.
10. PWA installation — short instructions for iOS Safari and Android Chrome.
11. License — `Proprietary — internal use only`.

---

## 18. Non-Functional Requirements

### 18.1 Performance

- First meaningful paint < 2 seconds on a typical 4G connection.
- API p95 response time < 300ms for all endpoints under expected load (≤10 concurrent users).
- Frontend main JS bundle (gzipped) target < 300KB; use `React.lazy` code-splitting for the Admin Dashboard route.

### 18.2 Scalability / Concurrency

Designed for ≤10 concurrent users. Azure SQL Free offer's 100,000 vCore-seconds/month and Azure Functions' 1M free executions/month both provide enormous headroom at this scale.

### 18.3 Accessibility

- All interactive elements have a minimum touch target of 44×44px.
- Colour contrast for text on coloured badges meets WCAG AA.
- All icon-only buttons (e.g. delete "✕") have an `aria-label`.

### 18.4 Code Quality

- TypeScript `strict` mode enabled in both `apps/frontend/tsconfig.json` and `apps/backend/tsconfig.json`.
- ESLint + Prettier configured at the root; `npm run lint` must pass with zero errors.
- Every exported function/component has a JSDoc/TSDoc comment.
- No unused dependencies; keep the dependency list minimal.

### 18.5 Browser & Device Support

- Latest two versions of Chrome (Android & desktop) and Safari (iOS & macOS), plus Edge.
- Verified installable as a PWA on iOS 16+ Safari and Android 12+ Chrome.

---

## 19. Acceptance Criteria / Definition of Done

### 19.1 Functional

1. All 15 functional requirements in Section 2.1 are implemented and match the prototype's design and copy.
2. Staff can log in, select a date, create an order with any combination of the 24 menu items (full or half plate), set order type and payment method, and submit it.
3. Marking a "Cash"/"UPI" order complete moves it to Completed with no extra prompts.
4. Marking a "Pending" order complete shows the `PaymentModal`, requires Cash or UPI selection, updates the stored payment method, and then moves the order to Completed.
5. Deleting an order requires confirmation and permanently removes it from the database.
6. Admin can log in separately and see accurate summary cards and item breakdown for any date.

### 19.2 Design

1. The MUI theme in Section 6 is implemented exactly — colours, radii, shadows, and status badge tokens are used consistently across all screens.
2. All animations in Section 6.7 are present and feel smooth on a mid-range mobile device.
3. Layouts adapt correctly at the breakpoints in Section 12.4.

### 19.3 PWA

1. Lighthouse PWA audit score ≥ 90.
2. App is installable on iOS Safari and Android Chrome, launching in standalone mode with the correct icon, name, and theme colour.
3. App shell loads offline after first visit.

### 19.4 Security

1. PINs are bcrypt-hashed; no plaintext PINs exist anywhere in code, config, or logs.
2. All protected endpoints reject requests without a valid JWT (401); admin-only endpoints reject non-admin tokens (403).
3. Helmet, CORS allow-listing, rate limiting on login, and the global error handler are all active.
4. Every SQL query uses parameterized inputs — no string-concatenated SQL exists anywhere.
5. zod validation rejects malformed requests (400) for every endpoint that accepts input.

### 19.5 Testing & Documentation

1. `npm run test` passes for both workspaces with coverage targets from Section 14.
2. `npm run lint` and `npm run build` succeed for both workspaces with zero errors.
3. `README.md` contains all sections from Section 17.
4. `docs/ARCHITECTURE.md`, `docs/API.md`, and `docs/DEPLOYMENT.md` exist and accurately describe the system.

### 19.6 Deployment

1. App is deployed to Azure Static Web Apps with Azure SQL Database on the Free offer tier.
2. Reachable over HTTPS from a mobile browser.
3. All environment variables configured per Section 16 — no secrets committed to the repo.

---

## 20. Implementation Roadmap (Suggested Build Order)

Each phase should result in a working, committable state.

1. **Phase 1 — Monorepo scaffolding:** root `package.json` with npm workspaces, `.gitignore`, `.editorconfig`, ESLint/Prettier configs, empty `apps/frontend` and `apps/backend` projects, `packages/shared` with `menu.ts` and `pricing.ts` (Section 9).
2. **Phase 2 — Theme:** implement `apps/frontend/src/theme/theme.ts` and `tokens.ts` exactly per Section 6; create a minimal `App.tsx` to verify the theme visually.
3. **Phase 3 — Database:** write `schema.sql` and `seed.sql` (Sections 8 & 9.5), `scripts/generatePinHash.ts` and `scripts/migrate.ts`, and `apps/backend/src/db/pool.ts`.
4. **Phase 4 — Backend auth:** `authService`, `authController`, `authRoutes`, `authMiddleware`, `rateLimiter`, and the Express app skeleton (`app.ts`) with helmet/cors/json/error-handler wired in (Section 13); `functions/api.ts` wraps it for Azure Functions. Write `auth.test.ts`.
5. **Phase 5 — Backend menu & orders:** `menuController/Service`, `ordersController/Service` (with server-side total recomputation per Section 10.2), `adminController/Service`. Write `menu.test.ts`, `orders.test.ts`, `admin.test.ts`, `pricing.test.ts`.
6. **Phase 6 — Frontend auth flow:** `AuthContext`, axios client with interceptors, `LoginPage` with `PinPad`, `ProtectedRoute`, routing skeleton in `App.tsx`. Write `PinPad.test.tsx`.
7. **Phase 7 — Frontend Staff flow:** `DateSelectPage`, `DayViewPage` (`OrderCard`, `StatChip`), `NewOrderPage` (`MenuGrid`, `OrderConfigPanel`, `SelectedItemsList`, `TotalBar`), `OrderDraftContext`, react-query hooks. Write `MenuGrid.test.tsx`, `TotalBar.test.tsx`, `OrderCard.test.tsx`, `pricing.test.ts`.
8. **Phase 8 — Pending-payment completion flow:** `PaymentModal` component and integration with `OrderCard`/`DayViewPage` per Section 10.4. Write `PaymentModal.test.tsx`.
9. **Phase 9 — Admin dashboard:** `AdminDashboardPage` with summary cards, item breakdown table, and orders list using `useAdminSummary`.
10. **Phase 10 — PWA:** configure `vite-plugin-pwa`, manifest, icons (generate momo-themed icon set at required sizes), iOS meta tags (Section 7). Run Lighthouse PWA audit.
11. **Phase 11 — Polish:** animations (Section 6.7), responsive QA across breakpoints (Section 12.4), validation messages (Section 10.7), toasts.
12. **Phase 12 — Documentation:** `README.md` (Section 17), `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/DEPLOYMENT.md` (Section 15).
13. **Phase 13 — Deployment:** provision Azure resources per Section 15, configure GitHub Actions, set environment variables, run migrations against live database, verify PWA installability on real iOS and Android devices.

---

*— End of PRD —*
