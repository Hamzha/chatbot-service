param(
    [int] $AppPort = 4000,
    [switch] $DryRun
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$jsDir = Join-Path $repoRoot "javascript-implementation"

if ($DryRun) {
    Write-Host "API command: npm run dev:api (in $jsDir)"
    Write-Host "PORT=$AppPort"
    exit 0
}

if (-not (Test-Path (Join-Path $jsDir "node_modules"))) {
    Write-Host "node_modules not found. Running npm install..."
    Push-Location $jsDir
    npm install
    Pop-Location
}

Write-Host "Starting Fastify API on http://127.0.0.1:$AppPort (Ctrl+C to stop)"

$env:PORT = $AppPort
Push-Location $jsDir
npm run dev:api
Pop-Location
