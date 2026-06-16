@description('Base name for resources')
param baseName string = 'millets-momo'

@description('Azure region')
param location string = resourceGroup().location

@description('SQL Server admin username')
param sqlAdminUser string = 'momoadmin'

@description('SQL Server admin password (min 8 chars, upper+lower+digit+symbol)')
@secure()
param sqlAdminPassword string

@description('SQL Database name')
param sqlDbName string = '${baseName}-db'

@description('Client public IP for SQL firewall (leave empty to skip)')
param clientIp string = ''

var sqlServerName = '${baseName}-sql'
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
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes: 33554432
    zoneRedundant: false
  }
}

output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output sqlDatabaseName string = sqlDbName
output sqlAdminUser string = sqlAdminUser