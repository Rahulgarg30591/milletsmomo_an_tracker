---
name: engineering-standards-index
description: Registry of all engineering-standards skills for this repo with one-line triggers and when to load each. Use for manual /skill discovery or to disambiguate which skill applies to a task. Auto-load when the user asks for the skills list, "which skill", "engineering standards", or invokes /engineering-standards-index.
---

# Engineering Standards Index

Registry of all engineering-standards skills in this repository. Each is a focused, repo-tailored SKILL.md under `.opencode/skills/<name>/`. They auto-load based on the file being edited; load this index manually to discover or disambiguate.

## Skill catalog

| # | Skill | Auto-triggers when editing | Scope |
|---|---|---|---|
| 1 | `backend-development` | `apps/backend/src/**` (.ts) | Layered arch, controllers, services, ESM `.js` imports, transactions, error pattern, validation, logging, config, naming, async, pagination/filter/sort |
| 2 | `frontend-development` | `apps/frontend/src/**` (.ts/.tsx) | Component arch, feature folders, React Query, Context/hooks, memoization, lazy routes, MUI `sx`, responsive, a11y, ErrorBoundary, loading/empty states, haptics, theme tokens |
| 3 | `type-safety` | any `.ts`/`.tsx` file | Strict tsconfig, ESM `.js` imports, string-literal unions (no `enum`), shared types as canonical, minimize `any` (aspirational `unknown`+narrowing), Zod `z.infer`, utility types, no `@ts-ignore` without comment |
| 4 | `database` | `apps/backend/src/db/**` or any file with SQL/`getPool`/`sql` | Schema frozen, parameterized `request.input()` only, dynamic `IN` via indexed params, singleton pool, N+1 prevention, transactions, snake→camel mapping, money tolerance, sargable WHEREs, additive migrations |
| 5 | `api-standards` | endpoints, routes, controllers, validators, response shapes | `/api` REST, `x-auth-token` header (not `Authorization`), PATCH for state changes, `{error}` shape, status-code table, Zod body+query+params, `authMiddleware`+`requireRole`, rate limits, backward-compat |
| 6 | `code-quality` | any source file edit | Small files/functions, naming, DRY via `shared`/`utils`, SOLID layering, dead-code removal, no comments unless WHY, JSDoc on exports, incremental refactor only |
| 7 | `performance` | lists, queries, render-heavy components, bundle/caching code | FE lazy/chunks/memo/virtualize>100, BE singleton pool + sargable + no N+1, 50kb body, Workbox cache strategy, immutable React Query updates, terser `drop_console` |
| 8 | `testing` | test files, `npm test`, testable code edits | Vitest (BE node, FE jsdom+RTL+MSW), ≥80% on BE services+utils, `*.test.ts(x)`, MSW per api module, mock mssql pool, supertest for controllers, regression-test before bug fix |
| 9 | `security` | auth/SQL/config/middleware/validators/login/JWT/bcrypt code | Zod on every input, server recomputes (no client trust), parameterized SQL only, bcrypt+JWT secrets, helmet CSP, 50kb body, rate limits, `dangerouslySetInnerHTML` forbidden, no `eval`, no logging bodies/headers, never return `pin_hash` |
| 10 | `git-workflow` | git commit/branch/PR commands, releases | Conventional Commits (≤50 subj), `feat/fix/chore/docs` branches, small PRs, review checklist, squash to main, green-CI gate, gitignored files |
| 11 | `documentation` | `docs/**`, `README.md`, `AGENTS.md`, `project-context` skill, JSDoc/comments | README commands, API.md endpoints (fix `x-auth-token` drift), ARCHITECTURE layering+13 tables, DEPLOYMENT, JSDoc on exports, minimal WHY comments, update `project-context`+`AGENTS.md` when rules change, optional ADR |
| 12 | `project-context` (existing) | any file in `apps/frontend`, `apps/backend`, `packages/shared`, or questions about menu/roles/stock/pricing | Domain/business knowledge: pages, roles, menu (24 items), pricing, supply, stock computation, API endpoints, DB schema, types, known bug-prone spots |

## How to use

- **Automatic**: OpenCode auto-loads the relevant skill(s) based on the `description` frontmatter when you edit matching files. You usually do not need to invoke manually.
- **Manual**: invoke a skill via `/skill <name>` or by name when you want its guidance for a task that does not auto-trigger it (e.g., asking "how should I structure this new endpoint?" loads `api-standards` + `backend-development`).
- **Disambiguation**: when multiple skills could apply, the more specific one wins. Editing a backend service file with SQL triggers `backend-development`, `database`, `type-safety`, and `security` — all are relevant; they are designed to compose without conflict (each covers a distinct concern).

## Cross-cutting rules (in every skill)

- Defer to `project-context` for domain/business facts.
- Defer to code over drifted docs.
- Never modify the DB schema to satisfy a standard.
- Never introduce breaking architectural changes.
- Never rewrite working code solely to satisfy a skill — apply to new/edited code incrementally.
- Encode the current pattern as the baseline; mark improvements as "prefer X for new code."
- Do not override explicit user instructions.
- `npm run typecheck && npm run lint` MUST pass before commit; `npm test` when tests exist.

## Relationship to project-context

`project-context` is the domain knowledge base (what the app does). The 11 engineering-standards skills are the how-it-should-be-built standards. Together they give a coding agent everything needed to produce consistent, correct code for this repo without repeated guidance.
