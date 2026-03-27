param(
  [int]$BackendPort = 8000
)

$ErrorActionPreference = "Stop"

$serveUrl = "http://127.0.0.1:$BackendPort/api/inngest"
npx inngest-cli@latest dev -u $serveUrl

