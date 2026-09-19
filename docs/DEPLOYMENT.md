# Deployment Guide

## Architecture Overview

| Component | Technology | Hosting |
|---|---|---|
| Frontend | React 18 + MUI 6 + Vite PWA | Azure Static Web Apps |
| Backend | Express 4 on Azure Functions v4 | Azure SWA Managed Functions |
| Database | Postgres | Supabase Free tier |

Both the static frontend and the managed API are hosted in a single **Azure Static Web Apps** resource. The database is **not** an Azure resource — it lives on Supabase and is reached over its shared transaction pooler.

---

## Prerequisites

1. **Azure subscription** (Static Web Apps Free tier is enough)
1. **Supabase project** — free tier, for the Postgres database
2. **GitHub account** for CI/CD
3. **Azure CLI** installed (`az login` to authenticate)
4. **Azure Functions Core Tools** v4 installed locally (`npm i -g azure-functions-core-tools@4`)
5. **Node.js** ≥ 18

---

## Step 1: Provision Azure Resources (Bicep)

A Bicep template at `infra/main.bicep` provisions all required resources in one deployment.

### What it creates

| Resource | Type | Name pattern |
|---|---|---|
| Resource group | `Microsoft.Resources/resourceGroups` | `millets-momo-rg` (default) |
| Static Web App (Free) | `Microsoft.Web/staticSites` | `millets-momo-swa` |
| SWA App Settings | `Microsoft.Web/staticSites/configuredAppSettings` | env vars below |

### Required environment variables

```bash
export DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres"
export MM_TOKEN_SECRET="<64-char-random-string>"  # HMAC token signing secret (optional; auto-generated if unset)
export RG_NAME="millets-momo-rg"               # Optional: resource group name
export LOCATION="centralindia"                 # Optional: Azure region
export ALLOWED_ORIGIN=""                        # Optional: CORS origin (auto-detected)
export REPO_URL="https://github.com/<owner>/<repo>"  # Optional: for SWA GitHub integration
export BRANCH="main"                            # Optional: deploy branch
```

### Run the deployment script

```bash
cd infra
chmod +x deploy.sh
./deploy.sh
```

Or deploy directly with Azure CLI:

```bash
az deployment group create \
  --resource-group millets-momo-rg \
  --template-file infra/main.bicep \
  --parameters baseName=millets-momo \
               databaseUrl="$DATABASE_URL" \
               tokenSecret="$MM_TOKEN_SECRET"
```

The script outputs the SWA URL after deployment.

---

## Step 2: Configure Environment Variables

### Azure SWA App Settings (auto-configured by Bicep)

The Bicep template sets these automatically:

| Key | Value |
|---|---|
| `DATABASE_URL` | Supabase shared transaction pooler URI (from parameter) |
| `MM_TOKEN_SECRET` | `<random-64-char-string>` (optional; app has a baked-in fallback) |
| `ALLOWED_ORIGIN` | `https://<swa-hostname>` (auto-detected) |
| `NODE_ENV` | `production` |

To update manually via Azure Portal → SWA → Configuration → App settings.

### Optional database tuning

None of these are required; the defaults suit the Supabase shared pooler.

| Key | Default | Purpose |
|---|---|---|
| `DB_POOL_MAX` | `5` | Max pooled connections per Functions instance |
| `DB_CONNECT_TIMEOUT_MS` | `15000` | How long to wait for a connection |
| `DB_STATEMENT_TIMEOUT_MS` | `20000` | Server-side cap on a single statement |
| `DB_SSL_STRICT` | unset | `true` verifies the TLS chain; needs a CA bundle Node trusts |

Locally, `MOMO_DB_PORT` moves the Docker Postgres host port if `5432` is taken.

### Local Development

```bash
cp apps/backend/local.settings.example.json apps/backend/local.settings.json
# Edit local.settings.json with your database credentials
```

### GitHub Secrets

In your GitHub repo → Settings → Secrets and variables → Actions, add:

| Secret | Value |
|---|---|
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Deployment token from Azure SWA (Portal → SWA → Get deployment token) |

For the DB migration workflow, also add:

| Secret | Value |
|---|---|
| `DATABASE_URL` | Supabase shared transaction pooler URI |

---

## Step 3: Database Migration

### Option A: Local migration (recommended for initial setup)

```bash
# Set environment variables (or use local.settings.json)
export DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres"

# Generate PIN hashes
npm run generate-pin-hash -- 1234   # staff PIN
npm run generate-pin-hash -- 5678   # admin PIN
```

Replace the placeholder hashes in `apps/backend/src/db/seed.sql`:

```sql
-- Replace <BCRYPT_HASH_OF_STAFF_PIN> with the generated hash
-- Replace <BCRYPT_HASH_OF_ADMIN_PIN> with the generated hash
```

Then run the migration:

```bash
npm run db:migrate
```

This executes `schema.sql` (creates tables and indexes) followed by `seed.sql` (inserts 30 menu items, 3 users and 8 supply items, then realigns the identity sequences).

### Option B: GitHub Actions migration (for production updates)

Use the `Database Migration` workflow in GitHub Actions:

1. Go to Actions → Database Migration → Run workflow
2. Select environment (`production` or `staging`)
3. Optionally check "Run seed.sql after schema?"
4. Run workflow

---

## Step 4: GitHub Actions CI/CD

The deployment pipeline uses two workflows:

### `azure-deploy.yml` — Build and Deploy

| Trigger | Behavior |
|---|---|
| Push to `main` | Production deployment |
| PR to `main` | Staging deployment + preview URL comment |
| PR closed | Cleanup staging environment |

Workflow steps:
1. Checkout repo
2. Setup Node.js 20 with npm cache
3. `npm ci` (resolves all workspaces)
4. Lint, typecheck, test
5. Build frontend (`npm run build -w apps/frontend`)
6. Build backend (`npm run build -w apps/backend`)
7. Deploy via Azure SWA action
8. PRs get a sticky comment with preview URL

### `db-migration.yml` — Database Schema and Seed

Manually triggered (`workflow_dispatch`) with environment selection.

### Required Files

- `.github/workflows/azure-deploy.yml`
- `.github/workflows/db-migration.yml`
- `infra/main.bicep`
- `infra/deploy.sh`
- `apps/frontend/vite.config.ts` (PWA + proxy config)
- `apps/backend/functions/api.ts` (Azure Functions entry point)
- `apps/backend/host.json` (Functions runtime config)

---

## Step 5: Local Development

```bash
# Install dependencies
npm install

# Copy and configure local settings
cp apps/backend/local.settings.example.json apps/backend/local.settings.json
# Edit local.settings.json with your database credentials

# Run both frontend and backend
npm run dev

# Or run individually
npm run dev:frontend   # Vite on :5173
npm run dev:backend    # Azure Functions on :7071
```

The Vite dev server proxies `/api/*` to `http://localhost:7071` (configured in `apps/frontend/vite.config.ts`).

---

## Step 6: Verification

### Post-Deploy Checklist

- [ ] Frontend loads at the SWA URL
- [ ] PWA is installable (Lighthouse PWA score ≥ 90)
- [ ] Login works with seeded PIN credentials
- [ ] Menu items load from `/api/menu`
- [ ] Orders can be created and viewed
- [ ] Admin dashboard shows summary data
- [ ] Supabase connection works (check Function app logs for pool errors)
- [ ] CORS allows the SWA origin

### Lighthouse Audit

Run Lighthouse in Chrome DevTools:
- **Performance**: Optimize bundle size if < 90 (currently ~166KB gzip)
- **Accessibility**: Verify color contrast meets WCAG AA
- **Best Practices**: All checks should pass
- **PWA**: Should score ≥ 90 with current manifest and service worker config

---

## Troubleshooting

### Cannot connect to Supabase

Use the **shared** transaction pooler (port 6543), shown in the Supabase dashboard under Connect → Transaction pooler. The direct connection and the dedicated pooler are IPv6-only, and Azure Functions has no IPv6 egress, so they fail to connect without the paid dedicated-IPv4 add-on.

If the password contains `@`, `#`, `/` or other reserved characters, percent-encode it inside the URI.

### provisioning via Bicep fails

- Ensure `az bicep install` is run first
- Verify the Azure subscription has the `Microsoft.Web` resource provider registered:
  ```bash
  az provider register --namespace Microsoft.Web
  ```

### CORS Errors

Ensure `ALLOWED_ORIGIN` in app settings matches your SWA URL exactly (including `https://`). The Bicep template auto-detects this from the SWA default hostname.

### Function App Startup Errors

Check application logs in the Azure Portal → Static Web App → Functions → Logs. Common issues:
- Missing `DATABASE_URL` app setting
- Using the IPv6-only direct connection instead of the shared pooler

### PWA Not Installable

Verify that `/icons/icon-192.png`, `/icons/icon-512.png`, and `/icons/maskable-512.png` are accessible at the deployed URL, and that `index.html` contains the required meta tags (`theme-color`, `apple-mobile-web-app-capable`, `apple-touch-icon`).

---

## Security Reminders

- **Never commit** `local.settings.json` or `.env` files (they are gitignored)
- **Change default PINs** before deploying to production
- **Use a strong `MM_TOKEN_SECRET`** (64+ random characters) in production for a stronger token signing secret
- **Rotate the Supabase database password** if it has ever been pasted outside a secret store
- **Review CSP headers** set by `helmet()` — add Azure SWA origin if needed
- **Store deployment token** in GitHub Secrets, never in code
- **Restrict database access** under Supabase → Settings → Database → Network restrictions if you need an IP allowlist