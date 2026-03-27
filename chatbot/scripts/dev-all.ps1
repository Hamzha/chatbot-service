param(
  [int]$BackendPort = 8000,
  [int]$FrontendPort = 3000
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path "$PSScriptRoot/.."
$scripts = Join-Path $root "scripts"

Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $scripts "run-backend.ps1"), "-Port", $BackendPort -WorkingDirectory $root
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $scripts "run-inngest.ps1"), "-BackendPort", $BackendPort -WorkingDirectory $root
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $scripts "run-frontend.ps1"), "-Port", $FrontendPort -WorkingDirectory $root

Write-Host "Launched backend, inngest, and frontend in new terminals."

