targetScope = 'subscription'

@description('Resource group that will contain the Static Web App.')
param resourceGroupName string

@description('Azure region for the resource group and Static Web App.')
param location string = 'westeurope'

@description('Globally unique Static Web App name.')
param staticWebAppName string

resource resourceGroup 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: resourceGroupName
  location: location
}

module staticWebApp 'static-web-app.bicep' = {
  name: 'staticWebAppDeployment'
  scope: resourceGroup
  params: {
    location: location
    staticWebAppName: staticWebAppName
  }
}

output resourceGroupName string = resourceGroup.name
output staticWebAppName string = staticWebApp.outputs.staticWebAppName
output defaultHostname string = staticWebApp.outputs.defaultHostname
