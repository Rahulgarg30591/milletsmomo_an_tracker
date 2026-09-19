@description('Base name for all resources')
param baseName string = 'millets-momo'

@description('Azure region for resources')
param location string = resourceGroup().location

@description('Postgres connection string for the Supabase shared transaction pooler (port 6543)')
@secure()
param databaseUrl string

@description('HMAC signing secret for API auth tokens (optional; app has a baked-in fallback). Set for a stronger production secret.')
@secure()
param tokenSecret string = ''

@description('Allowed CORS origins (comma-separated, e.g. https://foo.azurestaticapps.net,https://bar.azurestaticapps.net)')
param allowedOrigins string = ''

@description('GitHub repo for SWA deployment source (e.g. owner/repo)')
param repoUrl string = ''

@description('GitHub PAT for SWA CI/CD')
@secure()
param repositoryToken string = ''

@description('Branch for SWA deployment source')
param branch string = 'main'

var swaName = '${baseName}-swa'
var tags = {
  project: 'millets-momo'
}

// The database is hosted on Supabase and is not provisioned here. Only the
// Static Web App, which hosts the frontend and the API functions, is Azure's.
resource swa 'Microsoft.Web/staticSites@2023-12-01' = {
  name: swaName
  location: location
  tags: tags
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    repositoryUrl: repoUrl
    branch: branch
    repositoryToken: repositoryToken
    buildProperties: {
      appLocation: 'apps/frontend'
      apiLocation: 'apps/backend'
      outputLocation: 'dist'
    }
    stagingEnvironment: ''
    allowOverwrite: true
  }
}

var swaHostName = swa.properties.defaultHostname

resource swaAppSettings 'Microsoft.Web/staticSites/configuredAppSettings@2023-12-01' = {
  parent: swa
  name: 'appsettings'
  properties: {
    appSettings: {
      DATABASE_URL: databaseUrl
      MM_TOKEN_SECRET: tokenSecret
      ALLOWED_ORIGINS: empty(allowedOrigins) ? 'https://${swaHostName}' : allowedOrigins
      NODE_ENV: 'production'
    }
  }
}

output swaHostName string = swaHostName
output swaDefaultUrl string = 'https://${swaHostName}'
