---
name: code-quality
description: Code quality standards across all workspaces — readability, maintainability, simplicity, modular design, DRY, SOLID, naming, dead code, refactoring, comments, and documentation. Use when editing any source file. Auto-load for all code edits.
---

# Code Quality Standards

Authoritative quality standards for all workspaces. Code is the source of truth. Do not override explicit user instructions.

## Readability

- Small files. Target <300 lines per file. Files approaching 500+ lines (e.g., `DayViewPage.tsx`, `AdminDashboardPage.tsx`) are acceptable when they are cohesive single-page UIs, but new files should stay smaller.
- Small functions. A function should do one thing. If a controller function handles validation + logging + response shaping + error handling and exceeds ~40 lines, move the orchestration into a service or helper.
- Clear names over clever code. `getOrdersByDate` is better than `fetchByDt`. Optimize for the reader who arrives at 2am during an incident.
- Consistent formatting is enforced by Prettier (root `.prettierrc`). Never hand-format around Prettier — run `npm run lint` and let the tools normalize.

## Maintainability

- **Single Responsibility**: each module has one reason to change. Controllers change when the HTTP contract changes; services change when business rules change; validators change when input rules change.
- **Layer boundaries are hard**: controllers never touch the DB; services never touch Express types; routes never contain logic. If you find a DB query in a controller, move it to a service.
- **Dependency direction**: routes → controllers → services → db. Never import a controller from a service, or a route from a controller.
- **No circular imports**: `utils` and `constants` are leaves (no imports of services/controllers). `db/pool` is a leaf. Services may import utils/constants/db. Controllers import services + validators + middleware.

## Simplicity

- **YAGNI**: do not add abstractions, config flags, or parameters "for future use." Add them when the second use case arrives.
- **No speculative generics**: if a function has one concrete use, do not genericize it.
- **Prefer flat over nested**: avoid deeply nested ternaries and pyramids. Extract early-returns / guard clauses.
- **Prefer explicit over implicit**: a plain `if` is clearer than a clever `reduce` with side effects. The pricing logic uses explicit `if` branches for half/full/custom — that is the right level of explicitness for money math.

## Modular design

- **One resource per file** across all layers (`ordersService.ts`, `ordersController.ts`, `ordersRoutes.ts`, `orderValidators.ts`).
- **Co-locate related code**: a service's interfaces live in the service file; a component's props interface lives above the component.
- **Shared code goes in the right place**:
  - Cross-FE+BE types → `packages/shared/src/types.ts`.
  - FE-only types → `apps/frontend/src/types/index.ts`.
  - FE-only helpers → `apps/frontend/src/utils/`.
  - BE-only helpers → `apps/backend/src/utils/`.
  - Business constants (menu) → `packages/shared/src/menu.ts` + `apps/backend/src/constants/menu.ts` (mirror).
- **Extract on the third use**: if a code snippet appears 3 times, extract it to a util. Two occurrences is not yet duplication warranting extraction.

## DRY (Don't Repeat Yourself)

- **Shared logic**: pricing is in `packages/shared/src/pricing.ts` (FE) and `apps/backend/src/utils/pricing.ts` (BE). These are intentionally duplicated because the BE is the authority (server recomputes) and the FE needs a local copy for optimistic display. This specific duplication is acceptable — do not force a single source.
- **Types**: the three-way type duplication (shared / FE / BE-per-service) is a known friction point. When editing a shared type, update all three. See `type-safety` skill.
- **Validators**: share Zod sub-schemas (e.g., the `items` array in `createOrderSchema` and `updateOrderSchema`).
- **SQL**: if the same query appears in two services, extract a shared service function and import it. Do not copy-paste SQL.
- **Components**: if a UI pattern appears in 3+ pages, extract to `components/`.

## SOLID principles (applied pragmatically)

- **S**ingle Responsibility: see Maintainability above.
- **O**pen/Closed: extend via new files/functions, not by editing working ones. Add a new validator rather than overloading an existing one with optional flags.
- **L**iskov: function overrides/substitutes must honor the parent contract. Not heavily applicable (no inheritance/OOP) but applies to custom hooks: a hook wrapping React Query must return the query result shape.
- **I**nterface Segregation: prefer small, focused interfaces. `OrderDraftContextType` exposes many methods but they are all draft operations — cohesive. Do not create a giant god-context mixing unrelated concerns.
- **D**ependency Inversion: services depend on `getPool` (an abstraction over the concrete pool), not on `sql.connect` directly. Validators depend on Zod schemas, not on raw request parsing. Keep dependencies pointing at abstractions/leaves.

## Avoiding code duplication

- Before writing a helper, check `apps/frontend/src/utils/`, `apps/backend/src/utils/`, and `packages/shared/src/` for an existing one.
- Common helpers that exist: `formatDate`, `formatTimeLabel`, `computeLineTotal`, `computeOrderTotal`, `computeHalfPrice`, `buildMenu`, `getToday`, `formatQuantity`, `vibrate`/`haptics`, `exportDashboard`, `exportSupply`, tracking functions.
- Do not reinvent date formatting — use `formatDate` / `getToday` from `utils/dateUtils`.

## Dead code removal

- Remove unused imports, variables, and functions. `noUnusedLocals` and `noUnusedParameters` in tsconfig enforce this at compile time.
- ESLint `@typescript-eslint/no-unused-vars` warns (with `argsIgnorePattern: '^_'`). Prefix intentionally-unused params with `_`.
- If you remove a feature, remove its code, its tests, its types, and its documentation references in the same PR. Do not leave commented-out code.
- `dist/` is build output — never edit it; it is gitignored and regenerated.

## Refactoring guidelines

- **Incremental only**: refactor in the smallest possible diff. One concern per PR. Never mix a refactor with a feature/bugfix in the same commit.
- **Boy Scout rule**: leave the code a little better than you found it — fix a naming issue, remove a dead import — but do not rewrite entire files opportunistically.
- **Verify after refactoring**: run `npm run typecheck && npm run lint && npm test`. If tests exist for the refactored area, they must pass. If no tests exist, add at least one characterization test before refactoring.
- **Never refactor working code solely to satisfy a skill** — skills are guidance for new/edited code, not mandates to rewrite the existing codebase.
- **Extract, don't rewrite**: when breaking up a large function, extract sub-functions preserving behavior, verify, then improve.

## Naming conventions

- **Files**: `<resource>Routes.ts` / `<resource>Controller.ts` / `<resource>Service.ts` / `<resource>Validators.ts` (backend); `PascalCase.tsx` for components/pages, `camelCase.ts` for utils/hooks/api (frontend).
- **Functions/variables**: `camelCase` (`getOrders`, `createOrder`, `isFullyVerified`).
- **Types/interfaces**: `PascalCase` (`OrderItem`, `SupplyVerification`).
- **Constants**: `UPPER_SNAKE_CASE` (`FILLINGS`, `FULL_PRICES`, `JWT_SECRET`).
- **Zod schemas**: `<purpose>Schema` (`createOrderSchema`).
- **React components**: `PascalCase` (`OrderCard`, `PinPad`). Props interface: `<Component>Props`.
- **React hooks**: `use<Resource>` / `use<Behavior>` (`useOrders`, `useMenu`, `useAuth`).
- **Boolean variables**: `is`/`has`/`should` prefix (`isCompleted`, `hasConflict`, `isFullyVerified`).
- **Event handlers**: `handle<Event>` (`handleComplete`, `handleEdit`, `handlePaymentResolve`).

## Comments

- **Do not add comments unless asked.** This is a hard rule from `AGENTS.md`.
- Exception: comments explaining WHY (non-obvious business rules, security decisions, workaround reasons) are valuable. Comments explaining WHAT the code does are noise — the code should explain itself.
- When you must comment (security, bug workaround, non-obvious math), keep it to 1-2 lines, tight, and accurate.
- Never leave commented-out code in the repo.
- JSDoc/TSDoc on exported functions is encouraged per `AGENTS.md` but not mandatory — add it when the function's purpose/signature is non-obvious. See the `documentation` skill.

## Documentation (inline)

- JSDoc on exported service functions and shared utils when the signature is non-obvious:
  ```ts
  /**
   * Compute the line total for a menu item given quantity and half-plate flag.
   * Uses plate-based pricing: half preset (3 @ halfPrice), full preset (6 @ fullPrice),
   * or custom per-momo pricing for other quantities.
   */
  export function computeLineTotal(menuItemId, quantity, isHalf) { ... }
  ```
- Do not JSDoc trivial getters/setters or React components with obvious props.
- Keep JSDoc current — stale JSDoc is worse than none.

## Cross-cutting rules

- Defer to the `project-context` skill for domain facts.
- Defer to code over drifted docs.
- `npm run lint` and `npm run typecheck` MUST pass before commit.
- Apply standards to new and edited code; do not mass-rewrite working code.
- Never introduce complexity (new patterns, abstractions, libraries) without a concrete need.
