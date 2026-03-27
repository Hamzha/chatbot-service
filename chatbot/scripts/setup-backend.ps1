param(
  [switch]$ForceRecreateVenv
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path "$PSScriptRoot/.."
$backend = Join-Path $root "backend"
$venv = Join-Path $backend ".venv"

if ($ForceRecreateVenv -and (Test-Path $venv)) {
  Remove-Item -Recurse -Force $venv
}

if (-not (Test-Path $venv)) {
  python -m venv $venv
}

$python = Join-Path $venv "Scripts/python.exe"

& $python -m pip install --upgrade pip
& $python -m pip install -e $backend

$envExample = Join-Path $backend ".env.example"
$envFile = Join-Path $backend ".env"
if ((Test-Path $envExample) -and (-not (Test-Path $envFile))) {
  Copy-Item $envExample $envFile
  Write-Host "Created backend .env from .env.example"
}

Write-Host "Backend setup complete."

