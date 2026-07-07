---
name: testing
description: Testing standards for backend (Vitest + Supertest, ≥80% coverage on services and utils) and frontend (Vitest + React Testing Library + MSW). Use when writing or running tests, adding test files, or editing testable code. Covers unit, integration, component testing, mocking, test organization, coverage, and regression prevention. Auto-load when creating test files or running npm test.
---

# Testing Standards

Authoritative testing standards for both workspaces. Code is the source of truth. Do not override explicit user instructions.

## Frameworks

- **Backend**: Vitest (`vitest run`) + Supertest (for HTTP integration tests against the Express app).
- **Frontend**: Vitest (`vitest run`) + React Testing Library + MSW (Mock Service Worker for API mocking).
- Config: `apps/backend/vitest.config.ts` (`environment: 'node'`, `globals: true`), `apps/frontend/vitest.config.ts` (`environment: 'jsdom'`, `globals: true`, React plugin).
- `globals: true` means `describe`, `it`, `expect`, `vi` are available without imports. Match this convention.

## Test file location & naming

- **Backend**: tests live in `apps/backend/tests/` (currently empty — to be populated). File naming: `<unit>.test.ts` (e.g., `ordersService.test.ts`, `ordersController.test.ts`, `pricing.test.ts`).
- **Frontend**: tests co-located next to the source file: `<Component>.test.tsx` (e.g., `OrderCard.test.tsx`, `useOrders.test.ts`).
- One test file per unit (service, controller, component, hook, util).

## Coverage expectations

Per `AGENTS.md`: **≥80% statement coverage** on `apps/backend/src/services` and `apps/backend/src/utils`. These are the business-logic and pure-function layers — highest test value.

- **Must test (priority)**:
  - `apps/backend/src/utils/pricing.ts` — pure money math, high bug risk (`computeLineTotal`, `computeOrderTotal`, `computeHalfPrice`).
  - `apps/backend/src/utils/dateUtils.ts`, `utils/time.ts` — pure helpers.
  - `apps/backend/src/services/*.ts` — business logic + data access (mock the pool).
  - `apps/backend/src/validators/*.ts` — Zod schema validation (edge cases, invalid input).
- **Should test**:
  - `apps/backend/src/controllers/*.ts` — via Supertest against the Express app.
  - `apps/backend/src/middleware/authMiddleware.ts`, `rateLimiter.ts` — auth and rate-limit behavior.
- **Nice to have**:
  - `apps/frontend/src/components/*.tsx` — component rendering, props, interactions (RTL).
  - `apps/frontend/src/hooks/*.ts` — React Query hooks with MSW.
  - `apps/frontend/src/utils/*.ts` — pure helpers (pricing, formatters).
- **Do not test**: `apps/backend/src/db/pool.ts` (infrastructure), `apps/frontend/src/main.tsx` / `App.tsx` (wiring), `theme/` (static config).

## Backend testing patterns

### Service unit tests (mock the pool)

Mock `../db/pool.js` so service tests never hit a real database. Use `vi.mock`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../db/pool.js', () => ({
  getPool: vi.fn(),
}));

import { getOrders } from '../services/ordersService.js';
import { getPool } from '../db/pool.js';

describe('ordersService.getOrders', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps joined rows into orders with items', async () => {
    const mockRequest = {
      input: vi.fn().mockReturnThis(),
      query: vi.fn().mockResolvedValue({ recordset: [/* mock rows */] }),
    };
    (getPool as any).mockResolvedValue({ request: () => mockRequest });

    const result = await getOrders('2026-01-01');
    expect(result.orders).toHaveLength(1);
    expect(result.orders[0].items).toHaveLength(2);
  });
});
```

- Mock `getPool` to return an object with `request()` → `{ input: vi.fn().mockReturnThis(), query: vi.fn() }`.
- For transactions, mock `pool.transaction()` → `{ begin, request, commit, rollback }`.
- Test the row-mapping logic and the business rules (total computation, payment split, conflict detection), not the SQL syntax.

### Controller integration tests (Supertest)

Test the full Express stack with mocked services:

```ts
import request from 'supertest';
import app from '../src/app.js';
vi.mock('../services/ordersService.js');

describe('POST /api/orders', () => {
  it('returns 201 on valid input', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('x-auth-token', 'valid-token')
      .send({ orderDate: '2026-01-01', orderType: 'dine', paymentMethod: 'cash', items: [/* ... */] });
    expect(res.status).toBe(201);
  });

  it('returns 400 on invalid paymentMethod', async () => {
    const res = await request(app).post('/api/orders').send({ paymentMethod: 'invalid' });
    expect(res.status).toBe(400);
  });
});
```

- Mock `authMiddleware` or pass a valid test token. Mock the services so no DB is hit.
- Test status codes, response shape (`{ error }` for errors), and validation behavior.

### Pure util tests

No mocking needed — test inputs and outputs directly:

```ts
import { describe, it, expect } from 'vitest';
import { computeLineTotal } from '../utils/pricing.js';

describe('computeLineTotal', () => {
  it('half preset: 3 momos at half price', () => {
    expect(computeLineTotal(1, 3, true)).toEqual({ unitPrice: 50, lineTotal: 50 });
  });
  it('throws on unknown menu item', () => {
    expect(() => computeLineTotal(999, 6, false)).toThrow();
  });
});
```

## Frontend testing patterns

### Component tests (React Testing Library)

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import OrderCard from './OrderCard';
import type { Order } from '../types';

describe('OrderCard', () => {
  it('renders order time and total', () => {
    render(<OrderCard order={mockOrder} onComplete={vi.fn()} />);
    expect(screen.getByText('12:30')).toBeInTheDocument();
    expect(screen.getByText('₹109')).toBeInTheDocument();
  });

  it('calls onComplete when complete button clicked', () => {
    const onComplete = vi.fn();
    render(<OrderCard order={mockOrder} onComplete={onComplete} />);
    fireEvent.click(screen.getByLabelText('Complete order'));
    expect(onComplete).toHaveBeenCalledWith(mockOrder);
  });
});
```

- Query by role/label/text, not by test IDs (RTL philosophy). Use `getByLabelText` for accessible interactive elements.
- Wrap components needing React Query in a `QueryClientProvider` with a test `QueryClient` (`retry: false` to avoid slow tests).
- Wrap components needing context in their providers (`AuthProvider`, `ThemeProvider`).

### Hook tests (MSW)

Use MSW to intercept API calls:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useOrders } from './useOrders';

const server = setupServer(
  http.get('/api/orders', ({ request }) => HttpResponse.json({ date: '2026-01-01', orders: [] })),
);
beforeAll(() => server.listen());
afterAll(() => server.close());

describe('useOrders', () => {
  it('fetches orders by date', async () => {
    const { result } = renderHook(() => useOrders('2026-01-01'), { wrapper: QueryClientProvider });
    await waitFor(() => expect(result.current.data).toBeDefined());
  });
});
```

- Set up MSW handlers per API module. Reset handlers between tests with `server.resetHandlers()`.
- Mock the exact response shape the `api/` module returns.

## Mocking rules

- **Mock at module boundaries**: mock `db/pool.js` (not `mssql`), mock `services/*` (not controllers' internals), mock API via MSW (not axios internals).
- Use `vi.mock('<module-path>', () => ({ ... }))` for module mocks. Path is relative to the test file.
- `vi.fn()` for function mocks. `vi.clearAllMocks()` in `beforeEach` to reset call counts.
- `vi.mocked(fn)` for typed access to mock assertions.
- Do not mock the unit under test. Do not mock everything — mock only external dependencies (DB, network, filesystem).

## Test organization

- `describe('<unit name>', () => { ... })` at the top level.
- Group related cases in nested `describe` blocks by behavior/edge-case.
- `it('<does X when Y>')` — describe the behavior, not the implementation.
- `beforeEach` for shared setup (mock reset, common fixtures). `beforeAll`/`afterAll` for server lifecycle.
- Keep tests independent — one test's side effects must not affect another.

## Regression prevention

- **Before fixing a bug, write a failing test** that reproduces it. Then fix the code so the test passes. This proves the fix and prevents regressions.
- Known bug-prone spots (see `project-context` skill): supply "Create Order Text" on mobile, DayView summary item breakdown (all fillings/preparations), StockPage Cheese Corn consumption (`CheeseCorn` vs `Cheese Corn` string mismatch). When fixing any of these, add a regression test.
- Pin critical business rules with tests: plate-based pricing (half/full/custom presets), Platter stock split (`Math.round(quantity/3)` per filling), payment split arithmetic, settlement conflict threshold (`>0.01`).

## Running tests

```bash
npm test                              # all workspaces (--workspaces --if-present)
npm run test --workspace=apps/backend # backend only
npm run test --workspace=apps/frontend # frontend only
```

- Tests run via `vitest run` (single pass, no watch). Use `vitest` (no `run`) for watch mode during development.
- `npm run typecheck` and `npm run lint` must pass alongside tests before commit.

## Cross-cutting rules

- Defer to the `project-context` skill for business rules to test (pricing, stock, conflict detection).
- Defer to code over drifted docs.
- Tests must be deterministic — no real network, no real DB, no time-dependent assertions without `vi.useFakeTimers()`.
- Do not lower the 80% coverage target on services/utils. If a service is hard to test, it may need refactoring (extract pure logic).
- Apply test-first for bug fixes; add tests for new features.
