param(
    [int] $AppPort = 8000,
    [int] $InngestPort = 8288,
    [switch] $DryRun
)

$ErrorActionPreference = "Stop"

$cliVersion = if ($env:INNGEST_CLI_VERSION) { $env:INNGEST_CLI_VERSION } else { "latest" }
$embedModel = if ($env:OLLAMA_EMBED_MODEL) { $env:OLLAMA_EMBED_MODEL } else { "nomic-embed-text" }
$llmModel = if ($env:OLLAMA_MODEL) { $env:OLLAMA_MODEL } else { "qwen2.5:7b" }

$inngestUrl = "http://127.0.0.1:$AppPort/api/inngest"
$inngestCommand = "npx --yes inngest-cli@$cliVersion dev -u $inngestUrl --no-discovery --port $InngestPort"

function Resolve-OllamaExe {
    try {
        $cmd = Get-Command ollama -ErrorAction Stop
        if ($cmd -and $cmd.Source) { return $cmd.Source }
    } catch { }

    $candidate = "C:\Users\ahmed\AppData\Local\Programs\Ollama\ollama.exe"
    if (Test-Path $candidate) { return $candidate }
    return $null
}

if ($DryRun) {
    Write-Host "Inngest command: $inngestCommand"
    Write-Host "Will ensure Ollama models are present: $embedModel, $llmModel"
    exit 0
}

Write-Host "Ensuring required Ollama models are present..."
$ollamaExe = Resolve-OllamaExe
if (-not $ollamaExe) {
    throw "Ollama executable not found. Install Ollama or add it to PATH."
}

$modelsToPull = @($embedModel, $llmModel) | Select-Object -Unique
foreach ($model in $modelsToPull) {
    if ([string]::IsNullOrWhiteSpace($model)) { continue }
    Write-Host "Pulling Ollama model: $model"
    & $ollamaExe pull $model
}

Write-Host "Resetting local vector store: ./chroma_data"
$repoRoot = Split-Path -Parent $PSScriptRoot
$chromaDir = Join-Path $repoRoot "chroma_data"
Remove-Item -Recurse -Force $chromaDir -ErrorAction SilentlyContinue

$uploadsDir = Join-Path $repoRoot "uploads"

Write-Host "Starting Inngest dev server (port $InngestPort) pointing to $inngestUrl"

# Seed vectors in the background by ingesting any PDFs in ./uploads.
# This allows you to restart the workflow and re-create vectors automatically.
$seedJob = Start-Job -ArgumentList $repoRoot, $AppPort, $InngestPort, $uploadsDir -ScriptBlock {
    param($repoRoot, $appPort, $inngestPort, $uploadsDir)
    $ErrorActionPreference = "Stop"

    # Wait for the Inngest dev server to accept connections.
    $deadline = (Get-Date).AddSeconds(120)
    while ((Get-Date) -lt $deadline) {
        try {
            if (Test-NetConnection -ComputerName "127.0.0.1" -Port $inngestPort -InformationLevel Quiet) {
                break
            }
        } catch { }
        Start-Sleep -Seconds 1
    }

    if (-not (Test-Path $uploadsDir)) {
        Write-Host "Vector seeding: no uploads directory found at $uploadsDir"
        return
    }

    $pdfs = Get-ChildItem -Path $uploadsDir -Filter *.pdf -File -ErrorAction SilentlyContinue
    if (-not $pdfs -or $pdfs.Count -eq 0) {
        Write-Host "Vector seeding: no PDFs found in $uploadsDir"
        return
    }

    $pythonExe = Join-Path $repoRoot ".venv\\Scripts\\python.exe"
    if (-not (Test-Path $pythonExe)) {
        throw "Python not found at $pythonExe"
    }

    $seedScript = Join-Path $env:TEMP "seed_rag_vectors.py"

    # Convert to forward slashes to avoid Python escape issues with Windows paths.
    $repoRootPy = ($repoRoot -replace '\\', '/')
    $uploadsDirPy = ($uploadsDir -replace '\\', '/')
    $seedContent = @"
import asyncio
from pathlib import Path
import time
import inngest

repo_root = r"$repoRootPy"
app_port = int(r"$appPort")
inngest_port = int(r"$inngestPort")
uploads_dir = Path(r"$uploadsDirPy")

client = inngest.Inngest(
    app_id="rag_app",
    is_production=False,
    api_base_url=f"http://127.0.0.1:{app_port}",
    event_api_base_url=f"http://127.0.0.1:{inngest_port}/",
    serializer=inngest.PydanticSerializer(),
)

async def main():
    pdfs = sorted(uploads_dir.glob("*.pdf"))
    for pdf in pdfs:
        # Make source_id unique per seed run to avoid ingest throttling.
        source_id = f"{pdf.name}:{int(pdf.stat().st_mtime)}"
        await client.send(
            inngest.Event(
                name="rag/ingest_pdf",
                data={
                    "pdf_path": str(pdf.resolve()),
                    "source_id": source_id,
                },
            )
        )

asyncio.run(main())
"@
    Set-Content -Path $seedScript -Value $seedContent -Encoding UTF8
    & $pythonExe $seedScript
}

& npx --yes "inngest-cli@$cliVersion" dev -u $inngestUrl --no-discovery --port $InngestPort

Write-Host "Vector seeding job started (background). It will auto-ingest PDFs from ./uploads."

