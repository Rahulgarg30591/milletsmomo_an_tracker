---
name: frontend-development
description: Frontend engineering standards for apps/frontend (React 18 + MUI 6 + Vite + PWA + React Query + react-router v7 + Axios). Use when creating or editing files under apps/frontend/src — pages, components, context, hooks, api, theme, utils, types. Covers component architecture, feature-based folder structure, state management, hooks, rendering optimization, memoization, lazy loading, code splitting, routing, forms, API integration, error boundaries, loading/empty states, responsive design, accessibility, styling conventions, reusable components, and UX. Auto-load whenever a frontend .ts/.tsx file is touched.
---

# Frontend Development Standards

Authoritative engineering standards for `apps/frontend`. Code is the source of truth. Do not override explicit user instructions.

## Folder structure (feature-based)

```
src/
├── api/          One file per backend resource (ordersApi, menuApi, ...). Thin axios wrappers.
├── components/   Reusable UI. Sub-folders by concern (animations/).
├── context/      React Context providers (Auth, OrderDraft, Theme).
├── hooks/        Custom data hooks wrapping React Query (useOrders, useMenu, useAdminSummary).
├── pages/        Route-level page components (one default export per file).
├── theme/        MUI theme (theme.ts) + design tokens (tokens.ts).
├── types/        Frontend-local type re-exports/mirrors of shared types.
└── utils/        Pure helpers (pricing, date, formatters, tracking, export, offlineQueue).
```

- `pages/` components are route-level and may compose many `components/`. Components in `components/` must be reusable and not coupled to a specific route.
- Do not create a `components/` sub-folder per page. If a sub-component is used by only one page, define it in the same page file (see `StatCard` in `DayViewPage.tsx`).

## Component architecture

- **Function components only.** No class components except `ErrorBoundary` (React requires a class for `getDerivedStateFromError`).
- One default export per page file. Named exports for reusable components are acceptable; default export is the dominant pattern here.
- Props interface declared above the component, named `<Component>Props` (e.g., `OrderCardProps`).
- Destructure props in the function signature.
- Co-locate small single-use sub-components in the page file; extract to `components/` only when reused by 2+ pages.

### Component composition

```tsx
interface OrderCardProps {
  order: Order;
  onComplete: (order: Order) => void;
  onEdit?: (order: Order) => void;
}

function OrderCardBase({ order, onComplete, onEdit }: OrderCardProps) {
  // ...
}

const OrderCard = memo(OrderCardBase);
export default OrderCard;
```

## State management

Three tiers, do not mix them:

1. **Server state** → `@tanstack/react-query`. Use for all data fetched from the API. Never duplicate server data into `useState`.
2. **Cross-component app state** → React Context (`AuthContext`, `OrderDraftContext`, `ThemeContext`). Provider wraps the tree in `App.tsx`.
3. **Local UI state** → `useState` / `useReducer` within a single component (modal open, toast, selected tab).

- Context providers must expose a custom `use<Name>()` hook that throws if used outside the provider:

```tsx
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

- Context value objects must be memoized with `useMemo` when they contain multiple functions/values (see `OrderDraftContext`).
- All context callbacks must be wrapped in `useCallback`.

## React hooks & custom hooks

- Data hooks (`src/hooks/`) wrap React Query and live in their own file: `useOrders.ts`, `useMenu.ts`, `useAdminSummary.ts`. Pattern:

```ts
export function useOrders(date: string) {
  return useQuery({
    queryKey: ['orders', date],
    queryFn: () => getOrders(date),
    enabled: !!date,
  });
}
```

- Query keys: `['<resource>', ...identifiers]` (e.g., `['orders', date]`, `['supplyVerification', date]`). Use the resource name first for cache invalidation by prefix.
- `refetchInterval` for polling (DayView uses `30000`ms). Set `enabled` to guard against undefined params.
- `useCallback` for every function passed as a prop or used in a dependency array.
- `useMemo` for derived values from arrays/objects (filtered lists, totals).
- `useEffect` cleanup: always return the removeEventListener/clearTimeout/clearInterval in the effect body.
- `useRef` for values that should not trigger re-renders (scroll markers, timers).
- Rules of hooks: never call conditionally. Guard with `enabled` in queries instead.

## Routing

- `react-router-dom` v7. Routes declared in `App.tsx`.
- **Lazy load every page except `LoginPage`** via `lazy(() => import(...))`. Wrap routes in `<Suspense fallback={<PageLoader />}>`.
- **Protected routes**: wrap with `<ProtectedRoute requiredRole="staff">` or `"admin"`. Never render a protected page without the guard.
- Route params: `useParams<{ date: string }>()`. Navigation: `useNavigate()`.
- Unknown routes (`path="*"`) redirect to `/day/{today}`.
- Root `/` redirects to `/day/{today}`.
- Route table is owned by `App.tsx` — do not scatter route definitions across files.

## API integration

- One file per resource in `src/api/` (`ordersApi.ts`, `menuApi.ts`, ...). Each exports named async functions that call the shared `client` and return `res.data`.
- The shared `client` (`api/client.ts`) is an Axios instance with:
  - Base URL from `VITE_API_BASE_URL` or `/api` default.
  - Request interceptor: attaches `X-Auth-Token` header from `localStorage`.
  - Response interceptor: queues mutations when offline, redirects to `/login` on `401`.
- API functions must accept typed arguments (inline types matching shared/request shapes). Return types are currently untyped (`res.data` is `any`) — see `type-safety` skill for the aspirational improvement.
- Do not call `client` directly from components or pages. Always go through the `api/` module so it can be mocked in tests.

## Rendering optimization & memoization

- Wrap list-item components in `memo()` when they render in a `.map()` of potentially many items (`OrderCard`, `MenuGrid` items).
- `useMemo` for derived collections: `activeOrders`, `completedOrders`, `pendingAmount`.
- `useCallback` for handlers passed to memoized children or used in query/mutation configs.
- Avoid inline object/array creation in `sx` props for lists rendered many times — extract to a constant or `useMemo` when perf matters.
- Do not over-memoize: a component rendering once or twice does not need `memo`. Memoize when there are >10 instances or the parent re-renders frequently.

## Lazy loading & code splitting

- Route-level: `lazy()` per page (already done in `App.tsx`).
- Vendor-level: `vite.config.ts` `manualChunks` splits `vendor-react`, `vendor-mui`, `vendor-query`, `vendor-motion`, `vendor-charts`, `vendor-xlsx`, `vendor-icons`. Keep this updated when adding a major dependency.
- Do not introduce dynamic `import()` inside components unless the chunk is genuinely conditional (e.g., `xlsx` only when exporting). Heavy libs already in manualChunks do not need additional splitting.

## Forms

- No form library is currently used. Forms are controlled via `useState` / context + manual validation.
- Validation errors: store as boolean flags in state (`validationErrors: { type: boolean; payment: boolean }`), clear on user interaction.
- Submit handlers: validate before calling the API; show a `Toast` on error.
- Date inputs: use native `<input type="date">` via MUI `TextField` (see DayViewPage).
- Numeric inputs (quantities, amounts): clamp with `min`/`max` and parse to `Number` before sending.

## Error boundaries & error states

- `ErrorBoundary` wraps the entire app inside `AuthProvider`. It catches render errors and shows a retry UI.
- Do not add more error boundaries unless isolating a specific heavy/fragile subtree (e.g., charts). One top-level boundary is the baseline.
- API errors: handled via React Query `onError` callbacks → show `Toast` with `type: 'error'`. Do not throw in render.

## Loading & empty states

- **Loading**: use `SkeletonLoader` for lists (`isLoading && !data ? <SkeletonLoader count={3} /> : ...`). Use `PageLoader` for route-level Suspense fallback.
- **Empty**: show a dashed-border `Paper` with a heading + helper text (see "No active orders" in DayViewPage). Never render a blank section.
- **Error**: a `Toast` is the baseline. For persistent errors, a retry button calling `refetch()`.

## Responsive design

- MUI `sx` responsive objects are the dominant pattern: `fontSize: { xs: '0.85rem', md: '0.95rem' }`, `p: { xs: 1, md: 2 }`.
- Breakpoints: `xs` (mobile, default), `md` (desktop). Use `sm` sparingly. The app is mobile-first.
- Detect desktop with `useMediaQuery(theme.breakpoints.up('md'))` for layout switches (FAB position, show/hide desktop buttons).
- Test both mobile (375px) and desktop (≥960px) layouts. The app is a PWA primarily used on phones.

## Accessibility

- Every interactive icon-only `Button`/`IconButton` MUST have `aria-label` (see OrderCard edit/complete buttons).
- Focus styles: `&:focus-visible: { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 }` on all interactive elements.
- Do not use `tabIndex` to make non-interactive elements focusable. Use semantic elements (`<button>`, `<a>`, MUI `Button`).
- Color is never the sole indicator — pair color with text or icon (status badges have icon + label).
- Date pickers and native inputs must remain keyboard-operable.

## Styling conventions

- **MUI `sx` prop is the only styling approach.** No `styled()`, no `makeStyles`, no CSS files, no Tailwind. Inline `sx` keeps styles co-located with the element.
- Theme tokens from `theme/tokens.ts` (`palette`, `gradients`, `shadows`, `statusColors`, `haptics`). Reference semantic palette keys (`'primary.main'`, `'text.secondary'`, `'divider'`) not raw hex — except for one-off status colors that come from `statusColors`/`darkStatusColors`.
- Border radius scale: `{ xs: 1, md: 1.25 }` (8/10px) for cards, `16`/`20` for dialogs. Match `theme.ts` `shape.borderRadius: 12` baseline.
- Dark mode: read `theme.palette.mode === 'dark'` and branch colors. Tokens provide `statusColors` + `darkStatusColors`.
- Gradients/shadows: import from `tokens.ts`, do not inline raw gradient strings.
- Haptics: `vibrate(haptics.light|medium|success|error)` on key interactions (button taps, order complete, errors).

## Reusable components

- `components/` holds reusable building blocks: `PinPad`, `MenuGrid`, `OrderCard`, `SelectedItemsList`, `OrderConfigPanel`, `TotalBar`, `PaymentModal`, `StatChip`, `AppBar`, `BottomNav`, `OfflineBanner`, `PageLoader`, `ProtectedRoute`, `Toast`, `ErrorBoundary`.
- `components/animations/` holds motion primitives: `PageTransition`, `StaggerContainer`, `SkeletonLoader`, `PaymentSuccessDecoration`.
- A component is reusable if used by 2+ pages OR is a generic primitive (Loader, Toast, ErrorBoundary). Otherwise keep it in the page.

## Design consistency

- Primary green `#1B6B3A` (light) / `#4ADE80` (dark). Accent `#FF8C42` (light) / `#FBBF24` (dark).
- Card-based layouts. Status badges: pill-shaped `Box` with bg + fg + icon.
- Typography weights: `700` for headings/labels, `800` for big numbers/hero text, `500-600` for body.
- Consistent spacing scale via `sx`: gaps `0.5`/`0.75`/`1`, padding `1`/`1.25`/`1.5`/`2`.
- Animations via `framer-motion`: springs for success/entrance, `PageTransition` for route changes. Respect reduced-motion where feasible.

## UX best practices

- Optimistic updates for mutations (complete order): `onMutate` updates the cache immediately, `onError` rolls back, `onSettled` refetches. See `DayViewPage.completeMutation`.
- Haptic feedback on every primary action.
- Toast notifications for success/error of mutations.
- 30s auto-refetch for the main list view (DayView).
- Offline support: mutations queued via `offlineQueue`, `OfflineBanner` shown when disconnected.
- Scroll restoration: `sessionStorage` `scrollToOrderId` marker for returning to a specific order after navigation.

## Cross-cutting rules

- Defer to the `project-context` skill for business/domain facts (pages, roles, menu, pricing, stock).
- Defer to code over drifted docs.
- Never rewrite working code solely to satisfy a skill — apply standards to new and edited code.
- Do not introduce a global state library (Redux, Zustand) — React Query + Context is the architecture.
- Do not introduce a CSS-in-JS library beyond MUI's `sx`/`emotion` (already bundled).
- Encode the current pattern as the baseline; mark improvements as "prefer X for new code."
