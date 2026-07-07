---
name: type-safety
description: TypeScript strict-mode standards across all workspaces (apps/frontend, apps/backend, packages/shared). Use when editing any .ts/.tsx file. Covers strict tsconfig usage, avoiding any, strong typing, shared interfaces, generic types, utility types, type guards, runtime validation via Zod, type inference, ESM .js imports, and string-literal unions. Auto-load whenever TypeScript files are created or edited.
---

# Type Safety Standards

Authoritative TypeScript standards for all three workspaces. Code is the source of truth. Do not override explicit user instructions.

## Strict mode (non-negotiable)

All three `tsconfig.json` files set `"strict": true` plus:
- `"noUnusedLocals": true`
- `"noUnusedParameters": true`
- `"noFallthroughCasesInSwitch": true`
- `"forceConsistentCasingInFileNames": true`

Never weaken these. If a file fails to compile, fix the code, not the config. `skipLibCheck: true` stays (third-party `.d.ts` noise is acceptable).

## ESM `.js` import extensions

`apps/backend` and `apps/frontend` are ESM (`"type": "module"`, `moduleResolution: "bundler"`). **All relative imports MUST end in `.js`** even though the source is `.ts`:

```ts
// CORRECT
import { getPool } from '../db/pool.js';
import type { Order } from './types.js';

// WRONG — runtime resolution fails
import { getPool } from '../db/pool';
```

`packages/shared` uses extensionless imports internally (`'./menu'`, `'./types'`) because it is consumed via the workspace symlink and compiled by the consumer's bundler. Match the existing convention per workspace:
- `apps/backend/src/**` → `.js` extensions on all relative imports.
- `apps/frontend/src/**` → `.js` extensions on all relative imports.
- `packages/shared/src/**` → extensionless relative imports (current convention).

## String-literal unions over `enum`

This codebase uses string-literal unions for all categorical types, never `enum`:

```ts
orderType: 'dine' | 'pack';
paymentMethod: 'cash' | 'upi' | 'split' | 'pending';
role: 'staff' | 'admin';
category: 'momo_packet' | 'sauce' | 'dip';
operationType: 'verification' | 'closing_stock' | 'order_create' | 'order_update';
```

- Values MUST match the DB `CHECK` constraint values exactly.
- Zod schemas use `z.enum([...])` with the same values — they are the runtime source of truth.
- Do not introduce `enum` — it adds runtime objects and does not align with the JSON-serialized API contract.

## Shared types (canonical location)

Types are currently defined in three places that must stay in sync:
1. `packages/shared/src/types.ts` — canonical, consumed by both FE and BE.
2. `apps/frontend/src/types/index.ts` — frontend mirror (frontend cannot import all shared types due to build isolation).
3. Per-service interfaces in `apps/backend/src/services/*.ts` — backend-local shapes that include DB-specific fields.

**Rules:**
- When adding a type used by both FE and BE, define it in `packages/shared/src/types.ts` and export from `packages/shared/src/index.ts`.
- When adding a type used only by the frontend, define it in `apps/frontend/src/types/index.ts`.
- When adding a type used only by one backend service, co-locate it in that service file (e.g., `SupplyOrder` in `supplyService.ts`).
- Keep all three definitions in sync when a type spans boundaries. Drift here is a known source of bugs.
- Prefer the shared definition as the single source of truth; the frontend mirror exists for build/tooling reasons.

## Avoiding `any` (aspirational + incremental)

The repo's ESLint currently sets `@typescript-eslint/no-explicit-any: 'off'` and uses `any` in two well-defined spots: `catch (err: any)` blocks and mssql row mapping `(row: any) => ({...})`.

**Baseline (current allowance):** `any` is permitted in catch blocks and DB row mappers. Do not introduce `any` elsewhere.

**Aspirational targets for NEW and edited code — do not retrofit existing working code:**

1. **Catch blocks**: prefer `catch (err: unknown)` and narrow before use:
   ```ts
   catch (err: unknown) {
     if (err instanceof Error && err.name === 'ZodError') {
       res.status(400).json({ error: 'Invalid input' });
       return;
     }
     next(err as Error);
   }
   ```
   Helper to read `.status` safely:
   ```ts
   function getStatus(err: unknown): number {
     return (err as { status?: number }).status ?? 500;
   }
   ```

2. **mssql row mapping**: define a row-shape interface and cast:
   ```ts
   interface OrderRow {
     id: number; order_date: Date; time_label: string; /* ... */
   }
   return result.recordset.map((row: OrderRow) => ({
     id: Number(row.id),
     orderDate: formatDate(row.order_date),
     /* ... */
   }));
   ```

3. **`as any` / type assertions**: avoid. If a type assertion is unavoidable, add a brief inline comment explaining why. Never use `@ts-ignore` / `@ts-expect-error` without a comment naming the specific limitation.

**Future config change (suggested, not applied now):** consider tightening `@typescript-eslint/no-explicit-any` to `'warn'` once the catch-block and row-mapper patterns are migrated. Do this as a separate, dedicated PR — never silently.

## Generic types & utility types

- Use built-in utility types instead of redefining: `Partial<T>`, `Pick<T, K>`, `Omit<T, K>`, `Record<K, V>`, `Readonly<T>`, `ReturnType<T>`, `Parameters<T>`.
- For API request shapes derived from a response type, use `Omit` + explicit additions rather than retyping:
  ```ts
  type CreateOrderItem = Pick<OrderItem, 'menuItemId' | 'quantity' | 'isHalf'>;
  ```
- Generic functions: name the type parameter `T` for single-param, `TKey`/`TValue` for maps. Constrain with `extends` when meaningful.
- Avoid deep generic gymnastics — if a type takes >3 lines to express, a concrete interface is clearer.

## Type guards & narrowing

- Prefer `instanceof Error` and `typeof`/`in` checks over `as` casts.
- For discriminated unions (e.g., `paymentMethod`), switch on the discriminant — `noFallthroughCasesInSwitch` enforces exhaustiveness.
- For optional fields, narrow with `!= null` (covers both `null` and `undefined`).
- Zod's `.parse()` returns a typed result — use the inferred type, do not re-annotate.

## Runtime validation (Zod)

- All endpoint inputs are validated with Zod at the controller boundary (see `api-standards` and `backend-development` skills).
- Derive TS types from Zod schemas with `z.infer<typeof schema>` when the schema is the source of truth:
  ```ts
  export const createOrderSchema = z.object({ /* ... */ });
  export type CreateOrderInput = z.infer<typeof createOrderSchema>;
  ```
- For values crossing the FE→BE boundary, the Zod schema in `apps/backend/src/validators/` is the runtime authority; the shared TS interface is the compile-time authority. Keep them aligned.
- Do not add Zod to the frontend — runtime validation there is unnecessary (the BE is the authority). Frontend types are for editor safety only.

## Type inference best practices

- Let TypeScript infer return types for simple functions. Add explicit return types for:
  - Exported service functions (public API surface — explicit types prevent accidental shape changes).
  - Functions returning `Promise<T>` where `T` is non-obvious.
  - React custom hooks (return type drives consumer inference).
- Do not annotate every local variable — inference is safer and less noisy.
- `const` + literal types: use `as const` for tuple/object literals that should preserve literal types (e.g., the menu price arrays in `packages/shared/src/menu.ts`).

## `import type`

- Use `import type { ... }` for type-only imports (interfaces, types). This is already the pattern in frontend components (`import type { Order } from '../types'`).
- Mixed value+type imports: keep them together in a regular `import` if values are also imported from the same module; otherwise split.

## Cross-cutting rules

- Defer to the `project-context` skill for the full type catalog and field semantics.
- Defer to code over drifted docs.
- Never weaken `tsconfig.json` strictness to make code compile.
- Never introduce `enum`, `any`-typed public APIs, or untyped `Record<string, any>`.
- Apply aspirational improvements to new/edited code only; do not mass-rewrite existing files.
- The `npm run typecheck` command (run from root) checks all three workspaces — it MUST pass before any commit.
