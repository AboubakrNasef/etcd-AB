$ErrorActionPreference = 'Stop'

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Definition
$repositoryRoot = Split-Path -Parent $scriptDirectory
$projectDirectory = Join-Path $repositoryRoot 'server'
$graphPath = Join-Path $projectDirectory '.ua\knowledge-graph.json'
$dashboardDirectory = Join-Path $env:USERPROFILE '.codex\plugins\cache\understand-anything\understand-anything\2.9.7\packages\dashboard'
$preloadPath = Join-Path $scriptDirectory 'vite-preload.cjs'
$configPath = Join-Path $scriptDirectory 'vite.config.mjs'
$cacheDirectory = Join-Path $scriptDirectory '.vite-cache'

if (-not (Test-Path -LiteralPath $graphPath)) {
    throw "Knowledge graph not found: $graphPath"
}

if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
    throw 'npx was not found. Install Node.js, then run this script again.'
}

if (-not (Test-Path -LiteralPath (Join-Path $dashboardDirectory 'package.json'))) {
    throw "Understand Anything dashboard was not found: $dashboardDirectory"
}

if (-not (Test-Path -LiteralPath $preloadPath)) {
    throw "Vite preload shim was not found: $preloadPath"
}

if (-not (Test-Path -LiteralPath $configPath)) {
    throw "Vite config wrapper was not found: $configPath"
}

Write-Host "Starting Understand Anything for: $projectDirectory"
Write-Host 'The dashboard URL printed below must include its ?token= value.'
Write-Host 'Press Ctrl+C to stop the dashboard.'

$env:GRAPH_DIR = $projectDirectory
$env:UNDERSTAND_DASHBOARD_DIR = $dashboardDirectory
$env:UNDERSTAND_VITE_CACHE_DIR = $cacheDirectory
$env:NODE_OPTIONS = "--require=$preloadPath"
Push-Location $dashboardDirectory
try {
    npx vite --config $configPath --host 127.0.0.1 --configLoader runner
}
finally {
    Remove-Item Env:\NODE_OPTIONS -ErrorAction SilentlyContinue
    Remove-Item Env:\UNDERSTAND_DASHBOARD_DIR -ErrorAction SilentlyContinue
    Remove-Item Env:\UNDERSTAND_VITE_CACHE_DIR -ErrorAction SilentlyContinue
    Remove-Item Env:\GRAPH_DIR -ErrorAction SilentlyContinue
    Pop-Location
}
