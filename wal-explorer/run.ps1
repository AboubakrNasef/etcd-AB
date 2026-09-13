$ErrorActionPreference = 'Stop'

$appRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverRoot = Join-Path $appRoot 'server'
$webRoot = Join-Path $appRoot 'web'
$env:GOWORK = 'off'

if (-not (Test-Path (Join-Path $webRoot 'node_modules'))) {
    Write-Host 'Installing frontend dependencies...'
    Push-Location $webRoot
    try { npm install } finally { Pop-Location }
}

Start-Process powershell.exe -ArgumentList @(
    '-NoExit',
    '-Command',
    "Set-Location -LiteralPath '$serverRoot'; go run ."
) -WorkingDirectory $serverRoot

Start-Process powershell.exe -ArgumentList @(
    '-NoExit',
    '-Command',
    "Set-Location -LiteralPath '$webRoot'; npm run dev"
) -WorkingDirectory $webRoot

Write-Host 'WAL Explorer is starting.'
Write-Host 'Open http://127.0.0.1:5173 when the Vite terminal is ready.'
