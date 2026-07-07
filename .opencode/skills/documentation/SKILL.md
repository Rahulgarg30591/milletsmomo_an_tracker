---
name: documentation
description: Documentation standards — README maintenance, API documentation, code comments, architecture docs, feature docs, decision records. Use when editing docs/ files, README.md, AGENTS.md, the project-context skill, or adding JSDoc/comments. Auto-load when touching documentation files or adding exported functions that need JSDoc.
---

# Documentation Standards

Authoritative documentation standards. **Code is the source of truth — docs drift behind.** Do not override explicit user instructions.

## Principles

- **Code wins.** When docs and code disagree, the code is correct. Fix the docs.
- **Docs describe stable contracts** (API endpoints, architecture, deploy steps), not implementation details that change often.
- **Minimal, accurate, current.** A short correct doc beats a long stale doc.
- **Update docs in the same PR** as the code change that makes them stale. Do not defer doc updates.

## README.md (root)

- **Audience**: a new developer setting up the project locally.
- **Must stay current**: prerequisites (Node ≥18, npm ≥9, Docker), quick-start steps (`npm install` → `npm run local:setup` → `npm run local:dev`), login PINs (staff `9865`, admin `1703`), common commands table, tech stack table, project structure tree, license.
- **When to update**: when a prerequisite version changes, a setup step changes, or a new common command is added.
- **Do not**: duplicate the full endpoint list (that lives in `docs/API.md`), the full architecture (that lives in `docs/ARCHITECTURE.md`), or every business rule (that lives in the `project-context` skill).

## docs/API.md

- **Audience**: a developer integrating with or debugging the API.
- **Must stay current**: every endpoint (method, path, auth requirement, request body, query params, response shape, status codes).
- **Known drift to fix when touched**: the auth header is documented as `Authorization: Bearer <token>` but the code uses `x-auth-token`. Fix this — see `api-standards` skill. Every time you edit `docs/API.md`, verify the auth header section says `x-auth-token`.
- **Known drift to fix when touched**: the documented endpoint list is incomplete (missing supply verification, closing stock, settlement, staff logs, client logs). When you touch the file, add missing endpoints.
- **Format per endpoint**:
  ```
  ### METHOD `/api/path`
  [Auth: x-auth-token (staff+|admin|public)]
  #### Request
  { "field": "value" }
  #### Response 200
  { "field": "value" }
  #### Errors
  - 400: { "error": "..." }
  - 401: { "error": "..." }
  ```
- **Example values** must match actual Zod schemas and service return shapes. Verify against the code, not memory.

## docs/ARCHITECTURE.md

- **Audience**: a developer understanding the system structure.
- **Known drift to fix when touched**: says "4 tables" — there are 13. Says auth token in `sessionStorage` — it's in `localStorage`. Lists only 4 routes — there are 11 pages. Missing the supply/stock/settlement/staff-log subsystems entirely.
- **Must stay current**: monorepo layout, frontend layer (React + MUI + React Query + routing + PWA), backend layer (Express + Azure Functions + middleware stack + service layer), shared package, database schema (all 13 tables), security overview, PWA/offline overview.
- **When to update**: when a new subsystem is added, the middleware stack changes, or the schema changes (frozen currently — but if it changes, update here).
- **Component tree**: keep it at a high level (provider → router → pages → key components). Do not list every leaf component.

## docs/DEPLOYMENT.md

- **Audience**: a developer deploying to Azure.
- **Must stay current**: Azure resource names (`millets-momo-swa`, `millets-momo-sql`, `millets-momo-db`, RG `millets-momo-rg`, region `centralindia`), Bicep deployment steps (`npm run prod:setup`), DB migration steps (`npm run prod:db:migrate`), GitHub Actions workflow behavior (PR→staging, main→production), required secrets/Azure app settings.
- **When to update**: when an Azure resource name changes, a deploy step changes, or a new secret is required.

## Code comments

- **Do not add comments unless asked** (hard rule from `AGENTS.md` and the `code-quality` skill).
- **Exception — WHY comments**: add a brief comment when the code does something non-obvious (security decision, bug workaround, non-obvious business rule, unusual math). 1-2 lines, tight, accurate.
- **Never comment WHAT** the code does — the code should be self-explanatory. `// increment counter` above `counter++` is noise.
- **Never leave commented-out code** in the repo.
- Comments use `//` (line) or `/* */` (block). Match surrounding style.

## JSDoc/TSDoc on exports

- Encouraged on exported service functions and shared utils when the signature/purpose is non-obvious (per `AGENTS.md`).
- Format:
  ```ts
  /**
   * Compute the line total for a menu item given quantity and half-plate flag.
   * Plate-based: half preset (3 @ halfPrice), full preset (6 @ fullPrice),
   * or custom per-momo pricing for other quantities.
   */
  export function computeLineTotal(menuItemId, quantity, isHalf) { ... }
  ```
- Do not JSDoc trivial functions (simple getters, obvious wrappers, React components with clear props).
- Keep JSDoc current — stale JSDoc is worse than none. Update it when you change the function's behavior/signature.

## Architecture decision records (ADR)

- Optional, for significant architectural decisions (new dependency, pattern change, security tradeoff).
- Location: `docs/adr/` (create the directory if it does not exist).
- Filename: `NNNN-short-title.md` (zero-padded number, e.g., `0001-use-x-auth-token-not-authorization.md`).
- Format:
  ```
  # ADR NNNN: <title>
  ## Status
  Accepted | Superseded by ADR NNNN
  ## Context
  <why this decision is needed>
  ## Decision
  <what we decided>
  ## Consequences
  <impact, tradeoffs>
  ```
- Do not create ADRs for trivial decisions. Reserve for choices that future developers will question.

## Feature documentation

- The app does not have per-feature markdown docs — features are documented in the `project-context` skill (pages, menu, stock, settlement, etc.).
- **Update the `project-context` skill** when a feature's behavior, endpoints, or types change. This is the authoritative feature reference and is auto-loaded for any project-relevant task.
- Do not create scattered per-feature markdown files — keep feature knowledge in `project-context` and architectural knowledge in `docs/ARCHITECTURE.md`.

## project-context skill maintenance

- The `project-context` skill (`.opencode/skills/project-context/SKILL.md`) is the canonical project knowledge base. It is auto-loaded for any task touching the momo order domain.
- **Update it when**: endpoints are added/removed/changed, types change, business rules change (pricing, stock computation, settlement), known-bug-prone spots are fixed or added, pages are added/removed.
- Keep it aligned with code — it explicitly states "Code is source of truth (docs drift behind)" and must not itself drift.

## AGENTS.md maintenance

- `AGENTS.md` (root) is the agent instruction file — commands, directories, conventions, build order.
- **Update it when**: a new npm script is added, a directory is added, a convention changes (middleware stack, validation approach, security rule), or the build order state changes.
- Keep the "Build order" checklist state accurate (`✅` done).

## When to update which doc

| Change | Update |
|---|---|
| New endpoint | `docs/API.md` + `project-context` skill |
| New page | `docs/ARCHITECTURE.md` (route table + component tree) + `project-context` skill |
| Schema change | `docs/ARCHITECTURE.md` + `project-context` skill (schema is frozen — N/A currently) |
| New npm script | `README.md` (commands table) + `AGENTS.md` (commands table) |
| New env var | `local.settings.example.json` + `docs/DEPLOYMENT.md` (if production) |
| New convention/pattern | `AGENTS.md` + relevant engineering skill |
| New dependency (major) | `README.md` (tech stack) + `docs/ARCHITECTURE.md` |
| Business rule change | `project-context` skill |
| Bug-prone spot fixed | `project-context` skill (known bug-prone spots list) |

## Cross-cutting rules

- Defer to the `project-context` skill for what content belongs where.
- Defer to code over drifted docs — fix docs when you touch them.
- Do not create redundant documentation files — consolidate in the right place per the table above.
- Keep `docs/API.md` auth header as `x-auth-token` (fix the existing `Authorization: Bearer` drift when you edit it).
- Keep `docs/ARCHITECTURE.md` table count and route list current (fix the existing drift when you edit it).
- Never create documentation files unless explicitly required by the task or the table above.
