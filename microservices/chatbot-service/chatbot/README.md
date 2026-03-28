# Chatbot (Independent Project)

This is a fully standalone chatbot project with:

- `backend`: Python FastAPI + Inngest + modular RAG engine
- `frontend`: Next.js UI
- `scripts`: PowerShell helpers to setup and run everything

No code in `chatbot/` imports from other repo folders.

## Prerequisites

- Windows + PowerShell
- Python 3.10+ available in PATH
- Node.js + npm available in PATH

## 1) One-time setup (recommended)

Run from repository root:

```powershell
./chatbot/scripts/setup-backend.ps1
./chatbot/scripts/setup-frontend.ps1
```

What this does:

- Creates `chatbot/backend/.venv` and installs backend dependencies
- Creates `chatbot/backend/.env` from `.env.example` if missing
- Installs frontend dependencies
- Creates `chatbot/frontend/.env.local` from `.env.local.example` if missing

## 2) Configure environment

Edit:

- `chatbot/backend/.env`
- `chatbot/frontend/.env.local`

Backend provider switch:

- `MODEL_PROVIDER=openai` (requires `OPENAI_API_KEY`)
- `MODEL_PROVIDER=ollama` (requires local Ollama endpoint/model config)

## 3) Start all services (fastest path)

From repository root:

```powershell
./chatbot/scripts/dev-all.ps1
```

This opens new terminals and starts:

- Backend API (`http://127.0.0.1:8000`)
- Inngest dev server
- Frontend (`http://127.0.0.1:3000`)

## 4) Start services individually (optional)

From repository root:

```powershell
./chatbot/scripts/run-backend.ps1
./chatbot/scripts/run-inngest.ps1
./chatbot/scripts/run-frontend.ps1
```

Custom ports:

```powershell
./chatbot/scripts/run-backend.ps1 -Port 8001
./chatbot/scripts/run-inngest.ps1 -BackendPort 8001
./chatbot/scripts/run-frontend.ps1 -Port 3001
```

## 5) Verify it is running

- Frontend: `http://127.0.0.1:3000`
- Backend health: `http://127.0.0.1:8000/v1/health`
- Inngest route (backend): `http://127.0.0.1:8000/api/inngest`

## 6) Basic usage flow

1. Open frontend in browser
2. Upload a PDF
3. Wait for ingestion to complete
4. Ask a question about the uploaded content

## Troubleshooting

- **`Failed to fetch` in the browser on upload/query:**
  - Ensure the backend is running (`/v1/health`).
  - The UI calls the API from a different origin (e.g. `localhost:3000` → `127.0.0.1:8000`). The backend enables permissive CORS for local dev.
  - If you open the UI via your LAN IP (e.g. `http://10.10.0.4:3000`), set `NEXT_PUBLIC_API_BASE_URL` in `frontend/.env.local` to the same host the browser can reach for the API (e.g. `http://10.10.0.4:8000`) and expose the backend on `0.0.0.0` if needed.
- **Port already in use (3000/8000):**
  - Run frontend/backend with a different port using script params
- **`python-multipart` error:**
  - Re-run backend setup: `./chatbot/scripts/setup-backend.ps1`
- **Inngest events not processing:**
  - Ensure both backend and Inngest script terminals are running
- **Ollama mode not answering:**
  - Confirm Ollama is running (`http://127.0.0.1:11434`).
  - **`404` on `/api/generate`:** the chat model name is wrong or not pulled. Run `ollama list` and `ollama pull <OLLAMA_CHAT_MODEL>`. Do the same for `OLLAMA_EMBED_MODEL` if embeddings fail.

