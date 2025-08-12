#!/usr/bin/env pwsh
param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectName,
    
    [Parameter(Mandatory=$true)]
    [string]$AppId,
    
    [string]$Author = "riozee",

    [Parameter(Mandatory=$true)]
    [string]$Destination
)

Write-Host "🚀 Creating new CapViteTron project: $ProjectName at $Destination" -ForegroundColor Cyan

$templatePath = Split-Path $PSScriptRoot -Parent
$projectPath = (Resolve-Path $Destination).Path

# Copy template
New-Item -Path $projectPath -ItemType Directory -Force | Out-Null
$itemsToCopy = Get-ChildItem -Path $templatePath -Exclude "node_modules", ".git"
foreach ($item in $itemsToCopy) {
    if ($item.Name -ne (Split-Path $projectPath -Leaf)) {
        Copy-Item -Path $item.FullName -Destination $projectPath -Recurse -Force
    }
}
Write-Host "✅ Copied template to $projectPath"

# Update package.json
$packageJsonPath = Join-Path $projectPath "package.json"
$packageJson = Get-Content $packageJsonPath | ConvertFrom-Json
$packageJson.name = $ProjectName.ToLower()
$packageJson.author = $Author
$packageJson.build.appId = $AppId
$packageJson.build.productName = $ProjectName
$packageJson | ConvertTo-Json -Depth 10 | Set-Content $packageJsonPath
Write-Host "✅ Updated package.json"

# Update capacitor.config.ts
$capacitorConfigPath = Join-Path $projectPath "capacitor.config.ts"
$capacitorConfig = Get-Content $capacitorConfigPath -Raw
$capacitorConfig = $capacitorConfig -replace 'appId: "com\.example\.capvitetron"', "appId: `"$AppId`""
$capacitorConfig = $capacitorConfig -replace 'appName: "CapViteTron App"', "appName: `"$ProjectName`""
$capacitorConfig | Set-Content $capacitorConfigPath
Write-Host "✅ Updated capacitor.config.ts"

Write-Host ""
Write-Host "🎉 Project '$ProjectName' created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. cd $Destination"
Write-Host "2. npm install"
Write-Host "3. npm run dev"
Write-Host ""
