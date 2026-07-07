---
name: security
description: Security standards for apps/backend and apps/frontend — input validation, SQL injection prevention, auth/authz, secret management, secure headers, CSRF, XSS, sensitive data handling, environment variables. Use when editing auth, SQL, config, middleware, validators, or any code touching secrets/user input. Auto-load when touching security-sensitive code (authMiddleware, pool, validators, helmet, env, login, JWT, bcrypt).
---

# Security Standards

Authoritative security standards for all workspaces. Code is the source of truth. Do not override explicit user instructions. Security findings use normal clarity — do not compress security-critical rules.

## Input validation (defense in depth)

- **Every endpoint validates input with Zod** before any service logic runs. See `api-standards` and `backend-development` skills. No exceptions.
- Validate `req.body`, `req.query`, and `req.params`. Never trust client-supplied values.
- Zod schemas enforce: enum values matching DB `CHECK` constraints, positive integers for quantities/IDs, `YYYY-MM-DD` regex for dates, `min(0)` for money.
- Reject early: return `400` on validation failure. Do not pass invalid data to the service layer.
- The JSON body size is capped at `50kb` (`express.json({ limit: '50kb' })`) — do not raise this without strong justification.

## SQL injection prevention (critical)

**ALL SQL queries MUST use `request.input()` parameterized placeholders. String interpolation of user data into SQL is forbidden.**

```ts
// CORRECT
request.input('orderDate', sql.Date, date);
await request.query('SELECT * FROM Orders WHERE order_date = @orderDate');

// CRITICAL VULNERABILITY — never do this
await request.query(`SELECT * FROM Orders WHERE order_date = '${date}'`);
```

- This is the single most important security rule in this repo. Violations are critical bugs.
- See the `database` skill for the dynamic `IN (...)` pattern (only placeholder names are interpolated, never values).
- `mssql` parameterization handles escaping automatically — never manually escape strings.

## Authentication

- **PIN-based auth**: PINs are stored as **bcrypt hashes** (cost factor 10) in `Users.pin_hash`. Never store or log plaintext PINs.
- Use `bcryptjs` (the JS port, not native `bcrypt`) — `bcrypt.compare(pin, user.pin_hash)` for verification.
- PIN is a 4-digit string. The rate limiter (5 attempts / 15 min / IP) prevents brute force (10,000 combinations would take ~12 days at 5/15min).
- **JWT**: signed with `JWT_SECRET` (env var), `expiresIn: '12h'` (43200 seconds). Payload: `{ sub: userId, role, displayName }`.
- **JWT_SECRET MUST be set in production.** An empty `JWT_SECRET` (`''`) means `jsonwebtoken` signs with an empty string — a critical vulnerability. The app currently falls back to `''` — this is a known risk; ensure `JWT_SECRET` is always set in `.env.production` / Azure app settings.
- Token is transmitted via the custom `x-auth-token` header (NOT `Authorization`), because Azure SWA injects its own `Authorization` header. Do not change this.
- `authMiddleware` verifies the token on every `/api/*` route except `/api/auth/login` and `/api/health`.
- On `401`, the frontend (`api/client.ts`) clears `localStorage` and redirects to `/login`.

## Authorization

- `requireRole('admin')` guards admin-only routes. Applied in route files after `authMiddleware`.
- Access matrix (see `project-context` for full detail):
  - `staff` role: own orders, supply verification, closing stock, live stock.
  - `admin` role: everything staff can do + dashboard, supply orders, staff logs, payment settlement.
- Never expose an admin endpoint without `requireRole('admin')`. Never expose a mutating endpoint without `authMiddleware`.
- `req.user` is set by `authMiddleware`. Controllers extract `req.user?.id` for `createdBy` — return `401` if missing on mutating endpoints.

## Secret management

- **No secrets in Git.** Gitignored files: `local.settings.json`, `.env.development`, `.env.production`, `apps/backend/local.settings.json`.
- `local.settings.example.json` documents the required keys — keep it updated when adding env vars. It is the template; the real file is local-only.
- Required secrets: `JWT_SECRET`, `SQL_PASSWORD`. Required config (non-secret): `SQL_SERVER`, `SQL_DATABASE`, `SQL_USER`, `SQL_PORT`, `ALLOWED_ORIGINS`.
- Azure production secrets are set in Azure Portal app settings / Key Vault — never in the repo.
- Never log secrets, tokens, PINs, or password hashes. The `morgan` log format excludes bodies and headers — keep it that way.
- `npm run generate-pin-hash -- <4-digit-pin>` generates a bcrypt hash for updating seed PINs. Never commit a real PIN — only its hash.

## Environment variables

- Env loading: `db/pool.ts` `loadEnvConfig()` reads `.env.development` / `.env.production`, then `loadLocalSettings()` reads `local.settings.json` (dev only, not in production).
- Never `console.log` env vars. Never expose `process.env` to the frontend (frontend uses `VITE_*` prefixed vars only, e.g., `VITE_API_BASE_URL`).
- Access env via `process.env.KEY` with a safe default **only for non-sensitive values** (`NODE_ENV`, `SQL_PORT`). Sensitive values (`JWT_SECRET`, `SQL_PASSWORD`) must be set — do not provide a default that masks a missing secret.

## Secure headers (helmet)

`app.ts` configures `helmet` with a strict CSP and security headers. Do not weaken these:

- **CSP**: `defaultSrc 'self'`, `scriptSrc 'self'`, `styleSrc 'self' 'unsafe-inline'` (MUI requires inline styles), `imgSrc 'self' data: blob:`, `connectSrc 'self' <ALLOWED_ORIGINS>`, `frameSrc 'none'`, `objectSrc 'none'`.
- `crossOriginEmbedderPolicy: false` (needed for Azure SWA), `crossOriginOpenerPolicy: same-origin`, `crossOriginResourcePolicy: same-origin`.
- `hsts: maxAge 31536000, includeSubDomains, preload`.
- `frameguard: deny`, `noSniff`, `xssFilter`, `referrerPolicy: strict-origin-when-cross-origin`.
- `dnsPrefetchControl: { allow: false }`, `originAgentCluster`, `permittedCrossDomainPolicies: none`, `ieNoOpen`.

When adding a third-party script/style/font source, update the CSP `directives` in `app.ts` — never disable CSP.

## XSS prevention

- **`dangerouslySetInnerHTML` is forbidden** (per `AGENTS.md`). Never use it in React components.
- React auto-escapes JSX content — keep using JSX, do not construct HTML strings.
- Do not render user-supplied strings as HTML. All display values go through JSX interpolation `{value}`.
- The `itemSummary` and `details` staff-log fields are user-influenced strings displayed in the UI — they render via JSX, which escapes them. Do not change this to `innerHTML`.
- `xlsx` export uses the library's API (not HTML injection) — safe.

## CSRF protection

- The API uses `x-auth-token` (custom header), not cookies for auth. **Custom headers are not automatically sent by the browser** (unlike cookies), which provides CSRF resistance: a cross-origin form/fetch cannot set custom headers without a CORS preflight.
- `cors` is configured with a strict origin allowlist (`ALLOWED_ORIGINS` + localhost for dev). `credentials: true` is set but only honored for allowed origins.
- Do not switch to cookie-based auth without adding CSRF tokens (`csurf` or double-submit cookie).

## CORS

- `app.ts` CORS: allows no-origin (same-origin/curl), localhost (any port), and explicit `ALLOWED_ORIGINS`. All other origins are rejected.
- Never set `origin: '*'` — it would allow any site to call the API.
- When deploying to a new domain, add it to `ALLOWED_ORIGINS` (comma-separated).

## Rate limiting

- `loginLimiter`: 5 requests / 15 min / IP on `POST /api/auth/login`. Prevents PIN brute force.
- `globalLimiter`: 200 requests / min / IP on all other routes, skips `/api/health`.
- Rate-limit responses return `429` with `{ error: '...' }` and standard headers (`RateLimit-*`).
- Do not remove or loosen these limits. If a legitimate client hits the limit, investigate the cause before raising it.

## File uploads

- The app does not currently support file uploads. If added in the future:
  - Validate file type (MIME + extension), size (enforce a max), and filename (sanitize).
  - Store outside the web root; never serve user-uploaded files from the app directory.
  - Do not trust `Content-Type` — validate the file signature/magic bytes.
  - Scan for malicious content if the file type warrants it.

## Sensitive data handling

- **Never return `pin_hash`** in any API response. The `authService.login` query selects it but only uses it for `bcrypt.compare` — it is not included in the response. Audit any new `SELECT` on `Users` to ensure `pin_hash` is not leaked.
- **Never return `password`/`secret` fields** — the schema has none, but this rule applies if added.
- Staff log `details` may contain order summaries (item counts, totals, payment methods) — acceptable. Never include PINs or tokens in log details.
- `ClientActivityLogs` store frontend telemetry — do not log sensitive form values, tokens, or PINs in `details`/`metadata`.
- JWT payload contains `userId`, `role`, `displayName` — not the PIN. Safe to decode on the client.

## Output encoding

- Backend responses are JSON (`res.json`) — `express.json` serializes safely, no manual encoding needed.
- Frontend renders via JSX (auto-escaped). No `innerHTML`, no `dangerouslySetInnerHTML`.
- `xlsx` export writes cell values via the library API — safe.
- Clipboard text (`SupplyOrderPage` "Create Order Text") uses `navigator.clipboard.writeText` with a plain string — no HTML injection risk.

## Dependency security

- Run `npm audit` periodically. Address high/critical vulnerabilities.
- Do not add dependencies with known critical vulnerabilities.
- Keep `bcryptjs`, `jsonwebtoken`, `helmet`, `mssql`, `zod`, `express` updated within their major versions.

## Cross-cutting rules

- Defer to the `project-context` skill for role/access details.
- Defer to code over drifted docs.
- **Parameterized SQL is non-negotiable.** Any string-interpolated user value in SQL is a critical bug.
- **`JWT_SECRET` must be set in production.** An empty secret is a critical vulnerability.
- **`dangerouslySetInnerHTML` is forbidden.** No exceptions.
- Never log secrets, tokens, PINs, hashes, or request bodies/headers.
- Security findings and fixes use normal clarity — do not compress security-critical communication.
- Apply security standards to all new and edited code immediately (not aspirationally — security is not incremental).
