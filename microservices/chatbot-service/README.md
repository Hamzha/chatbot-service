# Local RAG App (Chroma + Inngest + Streamlit + Ollama)

This project runs a local PDF RAG workflow:

- **FastAPI + Inngest functions** for ingest/query orchestration
- **Chroma** for local vector storage
- **Streamlit** for upload and chat UI
- **Ollama** for local embeddings + LLM generation

## Prerequisites

- Windows with PowerShell
- Python/venv already set up for this repo
- Node.js (used by Inngest CLI via `npx`)
- [Ollama](https://ollama.com/) installed

## Environment

The `.env` file is expected to include:

- `EMBED_PROVIDER=ollama`
- `LLM_PROVIDER=ollama`
- `OLLAMA_BASE_URL=http://127.0.0.1:11434`
- `OLLAMA_EMBED_MODEL=nomic-embed-text`
- `OLLAMA_MODEL=qwen2.5:14b`

## First-time setup (Ollama models)

Start Ollama, then pull required models:

```powershell
ollama pull nomic-embed-text
ollama pull qwen2.5:14b
```

Optional health check:

```powershell
curl http://127.0.0.1:11434/api/tags
```

## Start the system

Run each command in a separate terminal from repo root:

```powershell
cd "c:\Users\ahmed\Documents\ai-agent-youtube"
```

### 1) Start API

```powershell
.\scripts\run-api.bat
```

### 2) Start Inngest dev server

```powershell
.\scripts\run-inngest.bat
```

### 3) Start Streamlit

```powershell
.\.venv\Scripts\python.exe -m streamlit run streamlit_app.py --server.port 8501
```

Open:

- `http://localhost:8501`

## Recommended after changing embedding model

Delete old vectors and re-ingest PDFs:

```powershell
Remove-Item -Recurse -Force .\chroma_data -ErrorAction SilentlyContinue
```

Then upload PDFs again from Streamlit.

## Troubleshooting

### `ConnectionRefusedError` to `127.0.0.1:11434`

Ollama is not running or not reachable.

- Start Ollama app or run:

```powershell
ollama serve
```

### Ingest/query returns no context

- Ensure PDF ingestion completed
- Re-upload (or rename) the PDF
- If embedding model changed, clear `chroma_data` and ingest again

### Inngest not processing events

- Confirm both API and Inngest terminals are running
- Ensure Inngest terminal shows server online on port `8288`

