$ErrorActionPreference = 'Stop'

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Definition
$repositoryRoot = Split-Path -Parent $scriptDirectory
$projectDirectory = Join-Path $repositoryRoot 'server'
$graphPath = Join-Path $projectDirectory '.ua\knowledge-graph.json'
$viewerVersion = '2.9.7'
$viewerUrl = "https://github.com/Egonex-AI/Understand-Anything/releases/download/v$viewerVersion/understand-anything-viewer.tgz"

if (-not (Test-Path -LiteralPath $graphPath)) {
    throw "Knowledge graph not found: $graphPath"
}

if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
    throw 'npx was not found. Install Node.js, then run this script again.'
}

Write-Host "Starting Understand Anything for: $projectDirectory"
Write-Host 'The dashboard URL printed below must include its ?token= value.'
Write-Host 'Press Ctrl+C to stop the dashboard.'

npx --yes $viewerUrl $projectDirectory
