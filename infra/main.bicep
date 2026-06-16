@description('Base name for all resources')
param baseName string = 'millets-momo'

@description('Azure region for resources')
param location string = resourceGroup().location

@description('SQL Server admin username')
param sqlAdminUser string

@description('SQL Server admin password')
@secure()
param sqlAdminPassword string

@description('JWT secret for API auth')
@secure()
param jwtSecret string

@description('Allowed CORS origin (SWA default hostname)')
param allowedOrigin string = ''

@description('GitHub repo for SWA deployment source (e.g. owner/repo)')
param repoUrl string = ''

@description('Branch for SWA deployment source')
param branch string = 'main'

@description('SKU for Azure SQL Database. Use Free tier F1 for prod-like dev.')
param sqlSkuName string = 'Free'

@description('SKU tier for Azure SQL Database')
param sqlSkuTier string = 'Free'

var sqlServerName = '${baseName}-sql'
var sqlDbName = '${baseName}-db'
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

resource sqlFirewallLocal 'Microsoft.Sql/servers/firewallRules@2023-05-01-preview' = {
  parent: sqlServer
  name: 'AllowLocalDev'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '255.255.255.255'
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
    repositoryToken: ''
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
      SQL_ENCRYPT: 'true'
      JWT_SECRET: jwtSecret
      JWT_EXPIRY: '12h'
      ALLOWED_ORIGIN: empty(allowedOrigin) ? 'https://${swaHostName}' : allowedOrigin
      NODE_ENV: 'production'
    }
  }
}

output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output sqlDatabaseName string = sqlDbName
output swaHostName string = swaHostName
output swaDefaultUrl string = 'https://${swaHostName}'