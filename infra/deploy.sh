#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RG_NAME="${RG_NAME:-millets-momo-rg}"
LOCATION="${LOCATION:-centralindia}"
DEPLOYMENT_NAME="millets-momo-$(date +%Y%m%d%H%M%S)"

SQL_ADMIN_USER="${SQL_ADMIN_USER:-momoadmin}"
SQL_ADMIN_PASSWORD="${SQL_ADMIN_PASSWORD:-}"
JWT_SECRET="${JWT_SECRET:-}"
ALLOWED_ORIGIN="${ALLOWED_ORIGIN:-}"
REPO_URL="${REPO_URL:-}"
BRANCH="${BRANCH:-main}"

if [[ -z "$SQL_ADMIN_PASSWORD" ]]; then
  echo "Error: SQL_ADMIN_PASSWORD env var required" >&2
  exit 1
fi

if [[ -z "$JWT_SECRET" ]]; then
  echo "Error: JWT_SECRET env var required" >&2
  exit 1
fi

echo "Creating resource group: $RG_NAME in $LOCATION"
az group create --name "$RG_NAME" --location "$LOCATION" --tags project=millets-momo

echo "Deploying Bicep template..."
DEPLOY_OUTPUT=$(az deployment group create \
  --resource-group "$RG_NAME" \
  --name "$DEPLOYMENT_NAME" \
  --template-file "$PROJECT_ROOT/infra/main.bicep" \
  --parameters \
      baseName=millets-momo \
      location="$LOCATION" \
      sqlAdminUser="$SQL_ADMIN_USER" \
      sqlAdminPassword="$SQL_ADMIN_PASSWORD" \
      jwtSecret="$JWT_SECRET" \
      allowedOrigin="$ALLOWED_ORIGIN" \
      repoUrl="$REPO_URL" \
      branch="$BRANCH" \
  --query 'properties.outputs' \
  --output json)

echo ""
echo "=== Deployment Outputs ==="
echo "$DEPLOY_OUTPUT" | jq '.'

SWA_URL=$(echo "$DEPLOY_OUTPUT" | jq -r '.swaDefaultUrl.value // empty')
SQL_FQDN=$(echo "$DEPLOY_OUTPUT" | jq -r '.sqlServerFqdn.value // empty')

if [[ -n "$SWA_URL" ]]; then
  echo ""
  echo "SWA URL: $SWA_URL"
fi
if [[ -n "$SQL_FQDN" ]]; then
  echo "SQL Server: $SQL_FQDN"
fi

echo ""
echo "Next steps:"
echo "  1. Run database migration: npm run db:migrate"
echo "  2. Set GitHub secret: AZURE_STATIC_WEB_APPS_API_TOKEN (get from SWA resource > Get deployment token)"
echo "  3. If using GitHub Actions, update repoUrl in Bicep params or re-run with REPO_URL set"