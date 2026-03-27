$ErrorActionPreference = "Stop"

$root = Resolve-Path "$PSScriptRoot/.."
$frontend = Join-Path $root "frontend"

Push-Location $frontend
try {
  npm install

  $envExample = Join-Path $frontend ".env.local.example"
  $envFile = Join-Path $frontend ".env.local"
  if ((Test-Path $envExample) -and (-not (Test-Path $envFile))) {
    Copy-Item $envExample $envFile
    Write-Host "Created frontend .env.local from .env.local.example"
  }
}
finally {
  Pop-Location
}

Write-Host "Frontend setup complete."

