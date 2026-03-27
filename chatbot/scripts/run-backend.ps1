param(
  [int]$Port = 8000
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path "$PSScriptRoot/.."
$backend = Join-Path $root "backend"
$python = Join-Path $backend ".venv/Scripts/python.exe"

if (-not (Test-Path $python)) {
  Write-Error "Backend venv missing. Run ./chatbot/scripts/setup-backend.ps1 first."
}

Push-Location $backend
try {
  & $python -m uvicorn app.main:app --reload --port $Port
}
finally {
  Pop-Location
}

