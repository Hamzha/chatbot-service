param(
    [int] $AppPort = 8000,
    [switch] $DryRun
)

$ErrorActionPreference = "Stop"

$pythonPath = ".venv\\Scripts\\python.exe"
$apiCommand = if (Test-Path $pythonPath) {
    "$pythonPath -m uvicorn main:app --reload --port $AppPort"
} else {
    "py -m uvicorn main:app --reload --port $AppPort"
}

if ($DryRun) {
    Write-Host "API command: $apiCommand"
    exit 0
}

Write-Host "Starting FastAPI on http://127.0.0.1:$AppPort (Ctrl+C to stop)"
if (Test-Path $pythonPath) {
    & $pythonPath -m uvicorn main:app --reload --port $AppPort
} else {
    & py -m uvicorn main:app --reload --port $AppPort
}

