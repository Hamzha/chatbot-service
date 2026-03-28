param(
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path "$PSScriptRoot/.."
$frontend = Join-Path $root "frontend"

Push-Location $frontend
try {
  if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
    Write-Host "Port $Port is already in use. Stop the existing process or run with -Port <other>." -ForegroundColor Yellow
  }
  npm run dev -- -p $Port
}
finally {
  Pop-Location
}

