---
name: git-workflow
description: Git and development workflow standards — commit quality, branch naming, pull requests, code reviews, merge strategy, release readiness. Use when committing, branching, creating PRs, or reviewing code. Auto-load when running git commit/branch/PR commands or preparing a release.
---

# Git & Development Workflow Standards

Authoritative workflow standards. Code is the source of truth. Do not override explicit user instructions. Commit messages and PR descriptions use normal clarity (compression risks misread).

## Branch naming

- Feature branches: `feat/<short-description>` (e.g., `feat/engineering-skills-library`).
- Bug fixes: `fix/<short-description>` (e.g., `fix/cheese-corn-stock-consumption`).
- Chores: `chore/<short-description>` (e.g., `chore/update-dependencies`).
- Docs: `docs/<short-description>` (e.g., `docs/fix-api-auth-header`).
- Use kebab-case (lowercase, hyphens). Keep branch names under ~40 characters.
- Branch from `main`. Rebase onto `main` before opening a PR if `main` has advanced.

## Commit messages (Conventional Commits)

Format:
```
<type>(<optional scope>): <subject>

<optional body>
<optional footer>
```

- **Subject**: ≤50 characters, imperative mood (`add` not `added`), no trailing period. Describes what the commit does.
- **Type**: `feat` (new feature), `fix` (bug fix), `chore` (build/tooling/deps), `docs` (documentation only), `refactor` (no behavior change), `test` (tests only), `perf` (performance improvement), `style` (formatting only).
- **Scope** (optional): the affected area (`orders`, `supply`, `auth`, `frontend`, `backend`, `shared`, `db`, `skills`).
- **Body** (optional): explain WHY (not what) when the reason is not obvious. Wrap at 72 characters.
- **Footer** (optional): breaking changes (`BREAKING CHANGE: ...`), issue refs (`Closes #123`).
- One logical change per commit. Do not mix a feature with a refactor or a fix with a dependency bump.

Examples:
```
feat(orders): support split payment on order completion
fix(stock): correct Cheese Corn consumption mapping
chore(deps): bump mssql to 11.0.1
docs(api): fix auth header to x-auth-token
```

## Staging changes

- Stage only the files relevant to the commit's intent. Never `git add -A` blindly — review `git status` and `git diff` first.
- Never commit secrets (`local.settings.json`, `.env.*`, API tokens, private keys). These are gitignored — verify with `git status` before committing.
- Never commit `dist/` (build output, gitignored).
- Never commit `node_modules/` (gitignored).
- If a hook rejects a commit, fix the issue and create a new commit — do not `--amend` the failed commit unless explicitly asked.

## Pull requests

- **One concern per PR**: a single feature, fix, or refactor. Small PRs review faster and revert cleaner.
- **PR title**: same format as the commit subject (`feat(orders): support split payment`).
- **PR description** (use normal clarity):
  - **What**: 1-2 sentences on the change.
  - **Why**: the motivation / problem solved.
  - **How**: key implementation decisions, alternatives considered.
  - **Testing**: how it was verified (`npm run typecheck && npm run lint && npm test`, manual steps, screenshots for UI).
  - **Breaking changes**: explicit call-out if any (FE+BE deploy coordination needed).
  - **Checklist**: (see Code Review below).
- Link related issues (`Closes #123`, `Refs #456`).
- Request review from the appropriate reviewer. Do not self-merge unless explicitly authorized.

## Code review checklist

Before approving a PR, verify:

- [ ] `npm run typecheck` passes (all three workspaces).
- [ ] `npm run lint` passes (no new warnings).
- [ ] `npm test` passes (or tests are added for new logic).
- [ ] No secrets committed (`git diff` checked for tokens/keys/hashes).
- [ ] All SQL uses parameterized `request.input()` — no string interpolation.
- [ ] All new endpoints have Zod validation.
- [ ] Auth: protected routes have `authMiddleware`; admin routes have `requireRole('admin')`.
- [ ] No `dangerouslySetInnerHTML`.
- [ ] No `console.log` left in committed code (dropped in prod build but noisy in dev).
- [ ] New types added to the right location (shared / FE-local / BE-per-service) and kept in sync.
- [ ] New env vars documented in `local.settings.example.json`.
- [ ] `docs/` and `project-context` skill updated if the endpoint set, schema, or business rules changed.
- [ ] No unrelated reformatting mixed into the PR (Prettier-only changes belong in a separate chore PR).

## Merge strategy

- **Squash and merge** to `main`: one commit per PR, clean history. The PR title becomes the commit subject.
- Do not merge commits directly to `main` (bypasses CI and review).
- Do not rebase a branch after others have reviewed it — create a new commit or communicate the rebase.
- After merge, delete the feature branch (local and remote).

## CI gates

`.github/workflows/azure-static-web-apps-nice-bay-0191cb900.yml` runs on every PR and push to `main`:
1. `npm ci` (clean install).
2. `npm run lint`.
3. `npm run typecheck`.
4. `npm run build --workspace=apps/frontend`.
5. `npm run build --workspace=apps/backend`.
6. Deploy to Azure SWA (PR → preview environment, `main` → production).

- **All gates must be green before merge.** A red CI block means the PR is not ready.
- PRs get a preview URL commented by the workflow — test the change on the preview before merging.
- If a gate fails, fix the root cause — do not disable the check or skip the step.

## Release readiness

- `main` is always deployable. The CI workflow auto-deploys on push to `main`.
- Before merging a PR to `main`, confirm:
  - All CI gates green.
  - Preview environment tested (for UI changes).
  - No breaking changes that require FE+BE coordination beyond what the single deploy handles (the CI builds both in one job, so a merged PR deploys atomically).
  - DB migrations (if any) are additive and safe to run on production — run `npm run prod:db:migrate` after deploy if schema changes are involved (currently the schema is frozen).
- Production secrets (`AZURE_STATIC_WEB_APPS_API_TOKEN_*`, `JWT_SECRET`, SQL credentials) are set in Azure Portal app settings — verify they exist before a deploy that depends on them.

## Gitignored files (never commit)

Per `.gitignore`: `node_modules/`, `dist/`, `.env.*`, `local.settings.json`, `apps/backend/local.settings.json`, OS files (`.DS_Store`), editor dirs (`.idea/`, `.vscode/` except shared configs). Verify with `git status` before every commit.

## When to commit

- Only commit when explicitly asked. Do not auto-commit after every edit.
- Before committing: `git status` → `git diff` → stage intended files only → write the commit message → commit.
- Never push without explicit instruction. Never force-push to `main`.
- If asked to commit and push, create a feature branch first (do not commit directly to `main` unless told otherwise), commit, push the branch, and optionally open a PR.

## Cross-cutting rules

- Defer to the `project-context` skill for what constitutes a "feature" vs "fix" in this domain.
- Defer to code over drifted docs.
- Commit messages and PR descriptions use normal clarity — do not compress (caveman mode does not apply here, per the caveman skill's own rules).
- Keep PRs small and reviewable; one concern per PR.
- Never commit secrets, build output, or unrelated reformatting.
