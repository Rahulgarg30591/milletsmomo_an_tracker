@description('Base name for all resources')
param baseName string = 'millets-momo'

@description('Azure region for resources')
param location string = resourceGroup().location

@description('SQL Server admin username')
param sqlAdminUser string = 'momoadmin'

@description('SQL Server admin password (min 8 chars, upper+lower+digit+symbol)')
@secure()
param sqlAdminPassword string

@description('SQL Database name')
param sqlDbName string = '${baseName}-db'

@description('JWT secret for API auth')
@secure()
param jwtSecret string

@description('Client public IP for SQL firewall (leave empty to skip)')
param clientIp string = ''

@description('Allowed CORS origins (comma-separated, e.g. https://foo.azurestaticapps.net,https://bar.azurestaticapps.net)')
param allowedOrigins string = ''

@description('GitHub repo for SWA deployment source (e.g. owner/repo)')
param repoUrl string = ''

@description('GitHub PAT for SWA CI/CD')
@secure()
param repositoryToken string = ''

@description('Branch for SWA deployment source')
param branch string = 'main'

@description('SKU for Azure SQL Database. Use Free tier F1 for prod-like dev.')
param sqlSkuName string = 'Free'

@description('SKU tier for Azure SQL Database')
param sqlSkuTier string = 'Free'

var sqlServerName = '${baseName}-sql'
var swaName = '${baseName}-swa'
var tags = {
  project: 'millets-momo'
}

resource sqlServer 'Microsoft.Sql/servers@2023-05-01-preview' = {
  name: sqlServerName
  location: location
  tags: tags
  properties: {
    administratorLogin: sqlAdminUser
    administratorLoginPassword: sqlAdminPassword
    version: '12.0'
    publicNetworkAccess: 'Enabled'
    minimalTlsVersion: '1.2'
  }
}

resource sqlFirewallAzure 'Microsoft.Sql/servers/firewallRules@2023-05-01-preview' = {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource sqlFirewallClient 'Microsoft.Sql/servers/firewallRules@2023-05-01-preview' = if (clientIp != '') {
  parent: sqlServer
  name: 'AllowClientIp'
  properties: {
    startIpAddress: clientIp
    endIpAddress: clientIp
  }
}

resource sqlDb 'Microsoft.Sql/servers/databases@2023-05-01-preview' = {
  parent: sqlServer
  name: sqlDbName
  location: location
  tags: tags
  sku: {
    name: sqlSkuName
    tier: sqlSkuTier
  }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes: 33554432
    zoneRedundant: false
  }
}

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
      SQL_SERVER: sqlServer.properties.fullyQualifiedDomainName
      SQL_DATABASE: sqlDbName
      SQL_USER: sqlAdminUser
      SQL_PASSWORD: sqlAdminPassword
      SQL_PORT: '1433'
      SQL_ENCRYPT: 'true'
      SQL_TRUST_CERT: 'false'
      JWT_SECRET: jwtSecret
      JWT_EXPIRY: '12h'
      ALLOWED_ORIGINS: empty(allowedOrigins) ? 'https://${swaHostName}' : allowedOrigins
      NODE_ENV: 'production'
    }
  }
}

output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output sqlDatabaseName string = sqlDbName
output swaHostName string = swaHostName
output swaDefaultUrl string = 'https://${swaHostName}'