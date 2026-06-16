# Deployment Guide

## Architecture Overview

| Component | Technology | Hosting |
|---|---|---|
| Frontend | React 18 + MUI 6 + Vite PWA | Azure Static Web Apps |
| Backend | Express 4 on Azure Functions v4 | Azure SWA Managed Functions |
| Database | Azure SQL | Azure SQL Free tier |

Both the static frontend and the managed API are hosted in a single **Azure Static Web Apps** resource.

---

## Prerequisites

1. **Azure subscription** with access to Azure SQL Free tier
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
| SQL Server | `Microsoft.Sql/servers` | `millets-momo-sql` |
| SQL Database (Free) | `Microsoft.Sql/servers/databases` | `millets-momo-db` |
| Firewall: Azure services | `Microsoft.Sql/servers/firewallRules` | `AllowAzureServices` |
| Firewall: Dev IPs | `Microsoft.Sql/servers/firewallRules` | `AllowLocalDev` |
| Static Web App (Free) | `Microsoft.Web/staticSites` | `millets-momo-swa` |
| SWA App Settings | `Microsoft.Web/staticSites/configuredAppSettings` | env vars below |

### Required environment variables

```bash
export SQL_ADMIN_USER="momoadmin"          # SQL admin username
export SQL_ADMIN_PASSWORD="<strong-password>"  # SQL admin password (min 8 chars)
export JWT_SECRET="<64-char-random-string>"     # JWT signing secret
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
               sqlAdminUser="$SQL_ADMIN_USER" \
               sqlAdminPassword="$SQL_ADMIN_PASSWORD" \
               jwtSecret="$JWT_SECRET"
```

The script outputs the SWA URL and SQL Server FQDN after deployment.

---

## Step 2: Configure Environment Variables

### Azure SWA App Settings (auto-configured by Bicep)

The Bicep template sets these automatically:

| Key | Value |
|---|---|
| `SQL_SERVER` | `<server>.database.windows.net` (from Bicep output) |
| `SQL_DATABASE` | `millets-momo-db` |
| `SQL_USER` | `<admin-username>` (from parameter) |
| `SQL_PASSWORD` | `<admin-password>` (from parameter) |
| `SQL_ENCRYPT` | `true` |
| `JWT_SECRET` | `<random-64-char-string>` (from parameter) |
| `JWT_EXPIRY` | `12h` |
| `ALLOWED_ORIGIN` | `https://<swa-hostname>` (auto-detected) |
| `NODE_ENV` | `production` |

To update manually via Azure Portal → SWA → Configuration → App settings.

### Local Development

```bash
cp apps/backend/local.settings.example.json apps/backend/local.settings.json
# Edit local.settings.json with your database credentials and JWT_SECRET
```

### GitHub Secrets

In your GitHub repo → Settings → Secrets and variables → Actions, add:

| Secret | Value |
|---|---|
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Deployment token from Azure SWA (Portal → SWA → Get deployment token) |

For the DB migration workflow, also add:

| Secret | Value |
|---|---|
| `SQL_SERVER` | `<server>.database.windows.net` |
| `SQL_DATABASE` | `millets-momo-db` |
| `SQL_USER` | `<admin-username>` |
| `SQL_PASSWORD` | `<admin-password>` |

---

## Step 3: Database Migration

### Option A: Local migration (recommended for initial setup)

```bash
# Set environment variables (or use local.settings.json)
export SQL_SERVER="<server>.database.windows.net"
export SQL_DATABASE="millets-momo-db"
export SQL_USER="<admin-username>"
export SQL_PASSWORD="<admin-password>"
export SQL_ENCRYPT="true"

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

This executes `schema.sql` (creates tables and indexes) followed by `seed.sql` (inserts 24 menu items + 2 users).

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
# Edit local.settings.json with your database credentials and JWT_SECRET

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
- [ ] Azure SQL connection works (check Function app logs for pool errors)
- [ ] CORS allows the SWA origin

### Lighthouse Audit

Run Lighthouse in Chrome DevTools:
- **Performance**: Optimize bundle size if < 90 (currently ~166KB gzip)
- **Accessibility**: Verify color contrast meets WCAG AA
- **Best Practices**: All checks should pass
- **PWA**: Should score ≥ 90 with current manifest and service worker config

---

## Troubleshooting

### Azure SQL Free Tier

The Free tier must be explicitly selected in the Azure Portal — it is not the default. If you see pricing errors, navigate to your SQL database → Configure pricing tier → select **Free (F1)**. The Bicep template defaults to `Free` / `Free` SKU.

### provisioning via Bicep fails

- Ensure `az bicep install` is run first
- Verify the Azure subscription has the `Microsoft.Sql` and `Microsoft.Web` resource providers registered:
  ```bash
  az provider register --namespace Microsoft.Sql
  az provider register --namespace Microsoft.Web
  ```

### CORS Errors

Ensure `ALLOWED_ORIGIN` in app settings matches your SWA URL exactly (including `https://`). The Bicep template auto-detects this from the SWA default hostname.

### Function App Startup Errors

Check application logs in the Azure Portal → Static Web App → Functions → Logs. Common issues:
- Missing `JWT_SECRET` or database connection env vars
- Database firewall blocking Azure services (ensure `AllowAzureServices` firewall rule exists)

### PWA Not Installable

Verify that `/icons/icon-192.png`, `/icons/icon-512.png`, and `/icons/maskable-512.png` are accessible at the deployed URL, and that `index.html` contains the required meta tags (`theme-color`, `apple-mobile-web-app-capable`, `apple-touch-icon`).

---

## Security Reminders

- **Never commit** `local.settings.json` or `.env` files (they are gitignored)
- **Change default PINs** before deploying to production
- **Use a strong `JWT_SECRET`** (64+ random characters)
- **Enable Azure SQL firewall** — only allow Azure services and your dev IP
- **Review CSP headers** set by `helmet()` — add Azure SWA origin if needed
- **Store deployment token** in GitHub Secrets, never in code
- **Restrict `AllowLocalDev` firewall rule** to your IP in production (edit Bicep params)