param(
    [int] $AppPort = 4000,
    [int] $InngestPort = 8288,
    [int] $ChromaPort = 8000,
    [switch] $DryRun
)

$ErrorActionPreference = "Stop"

$cliVersion = if ($env:INNGEST_CLI_VERSION) { $env:INNGEST_CLI_VERSION } else { "latest" }
$embedModel = if ($env:OLLAMA_EMBED_MODEL) { $env:OLLAMA_EMBED_MODEL } else { "nomic-embed-text" }
$llmModel   = if ($env:OLLAMA_MODEL)       { $env:OLLAMA_MODEL }       else { "qwen2.5:7b" }

$repoRoot   = Split-Path -Parent $PSScriptRoot
$jsDir      = Join-Path $repoRoot "javascript-implementation"
$chromaDir  = Join-Path $jsDir "chroma_data"
$uploadsDir = Join-Path $jsDir "uploads"

$inngestUrl     = "http://127.0.0.1:$AppPort/api/inngest"
$inngestCommand = "npx --yes inngest-cli@$cliVersion dev -u $inngestUrl --no-discovery --port $InngestPort"

function Resolve-OllamaExe {
    try {
        $cmd = Get-Command ollama -ErrorAction Stop
        if ($cmd -and $cmd.Source) { return $cmd.Source }
    } catch { }

    $candidate = Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"
    if (Test-Path $candidate) { return $candidate }
    return $null
}

function Resolve-ChromaExe {
    try {
        $cmd = Get-Command chroma -ErrorAction Stop
        if ($cmd -and $cmd.Source) { return $cmd.Source }
    } catch { }
    return $null
}

if ($DryRun) {
    Write-Host "Inngest command : $inngestCommand"
    Write-Host "ChromaDB        : chroma run --path $chromaDir --port $ChromaPort"
    Write-Host "Ollama models   : $embedModel, $llmModel"
    Write-Host "Uploads dir     : $uploadsDir"
    exit 0
}

# ── 1. Pull Ollama models ────────────────────────────────────────────────────
Write-Host "`n=== Ensuring required Ollama models are present ==="
$ollamaExe = Resolve-OllamaExe
if (-not $ollamaExe) {
    throw "Ollama executable not found. Install Ollama or add it to PATH."
}

$modelsToPull = @($embedModel, $llmModel) | Select-Object -Unique
foreach ($model in $modelsToPull) {
    if ([string]::IsNullOrWhiteSpace($model)) { continue }
    Write-Host "  Pulling: $model"
    & $ollamaExe pull $model
}

# ── 2. Reset ChromaDB data ───────────────────────────────────────────────────
Write-Host "`n=== Resetting local vector store: $chromaDir ==="
Remove-Item -Recurse -Force $chromaDir -ErrorAction SilentlyContinue

# ── 3. Start ChromaDB server (background) ────────────────────────────────────
Write-Host "`n=== Starting ChromaDB server on port $ChromaPort (background) ==="
$chromaExe = Resolve-ChromaExe
if (-not $chromaExe) {
    throw "ChromaDB CLI not found. Install it with: pip install chromadb"
}

$chromaJob = Start-Job -ArgumentList $chromaExe, $chromaDir, $ChromaPort -ScriptBlock {
    param($exe, $dataDir, $port)
    & $exe run --path $dataDir --port $port
}

$chromaDeadline = (Get-Date).AddSeconds(30)
$chromaReady = $false
while ((Get-Date) -lt $chromaDeadline) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("127.0.0.1", $ChromaPort)
        $tcp.Close()
        $chromaReady = $true
        break
    } catch { }
    Start-Sleep -Milliseconds 500
}
if (-not $chromaReady) {
    Write-Host "WARNING: ChromaDB may not be ready yet. Continuing anyway..."
} else {
    Write-Host "  ChromaDB is listening on port $ChromaPort"
}

# ── 4. Background vector seeding ─────────────────────────────────────────────
Write-Host "`n=== Starting background vector seeding job ==="
$seedJob = Start-Job -ArgumentList $jsDir, $AppPort, $InngestPort, $uploadsDir -ScriptBlock {
    param($jsDir, $appPort, $inngestPort, $uploadsDir)
    $ErrorActionPreference = "Stop"

    # Wait for both the API and Inngest dev server to accept connections.
    $deadline = (Get-Date).AddSeconds(120)
    $apiReady = $false
    $inngestReady = $false
    while ((Get-Date) -lt $deadline) {
        try {
            if (-not $apiReady) {
                $tcp = New-Object System.Net.Sockets.TcpClient
                $tcp.Connect("127.0.0.1", $appPort)
                $tcp.Close()
                $apiReady = $true
            }
            if (-not $inngestReady) {
                $tcp = New-Object System.Net.Sockets.TcpClient
                $tcp.Connect("127.0.0.1", $inngestPort)
                $tcp.Close()
                $inngestReady = $true
            }
            if ($apiReady -and $inngestReady) { break }
        } catch { }
        Start-Sleep -Seconds 1
    }

    if (-not $apiReady -or -not $inngestReady) {
        Write-Host "Vector seeding: timed out waiting for API/Inngest to be ready"
        return
    }

    Start-Sleep -Seconds 3

    if (-not (Test-Path $uploadsDir)) {
        Write-Host "Vector seeding: no uploads directory found at $uploadsDir"
        return
    }

    $pdfs = Get-ChildItem -Path $uploadsDir -Filter *.pdf -File -ErrorAction SilentlyContinue
    if (-not $pdfs -or $pdfs.Count -eq 0) {
        Write-Host "Vector seeding: no PDFs found in $uploadsDir"
        return
    }

    foreach ($pdf in $pdfs) {
        $filePath = $pdf.FullName -replace '\\', '/'
        $sourceId = "$($pdf.Name):$([int](Get-Date $pdf.LastWriteTime -UFormat '%s'))"
        $eventBody = @{
            name = "rag/ingest-pdf"
            data = @{
                filePath = $filePath
                sourceId = $sourceId
            }
        } | ConvertTo-Json -Depth 4

        try {
            Invoke-RestMethod `
                -Method Post `
                -Uri "http://127.0.0.1:$inngestPort/e/test" `
                -ContentType "application/json" `
                -Body $eventBody | Out-Null
            Write-Host "Vector seeding: sent ingest event for $($pdf.Name)"
        } catch {
            Write-Host "Vector seeding: FAILED to send event for $($pdf.Name) - $_"
        }
    }

    Write-Host "Vector seeding: done"
}

# ── 5. Start Inngest dev server (foreground) ─────────────────────────────────
Write-Host "`n=== Starting Inngest dev server (port $InngestPort) ==="
Write-Host "  Pointing to $inngestUrl"
Write-Host "  Dashboard: http://127.0.0.1:$InngestPort`n"

try {
    & npx --yes "inngest-cli@$cliVersion" dev -u $inngestUrl --no-discovery --port $InngestPort
} finally {
    Write-Host "`nStopping background jobs..."
    if ($chromaJob) { Stop-Job $chromaJob -ErrorAction SilentlyContinue; Remove-Job $chromaJob -Force -ErrorAction SilentlyContinue }
    if ($seedJob)   { Stop-Job $seedJob   -ErrorAction SilentlyContinue; Remove-Job $seedJob   -Force -ErrorAction SilentlyContinue }
}
