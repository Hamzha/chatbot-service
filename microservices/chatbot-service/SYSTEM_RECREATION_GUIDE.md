# RAG App Recreation Guide

This document explains the complete system so anyone can recreate it from scratch.

## 1) What this project is

A local Retrieval-Augmented Generation (RAG) app for PDFs with:

- PDF ingestion and chunking
- Vector indexing in a local database
- Question answering over indexed chunks
- UI for upload + chat
- Event/workflow orchestration for observability and retries

## 2) Tech stack

- **Python**: core application language
- **FastAPI**: API host for Inngest function endpoints
- **Inngest**: workflow/event orchestration for ingest and query flows
- **Streamlit**: user interface for upload and Q&A
- **Chroma**: local vector store (`chroma_data/`)
- **LlamaIndex file reader + splitter**: PDF extraction + chunk splitting
- **Ollama**:
  - local embeddings model (default `nomic-embed-text`)
  - local generator model (default `qwen2.5:14b`)

Optional fallback paths in code:
- OpenAI embeddings and generation path still exists, but current `.env` uses Ollama.

## 3) High-level architecture

1. User uploads PDF in Streamlit
2. Streamlit sends `rag/ingest_pdf` event to Inngest
3. Inngest invokes FastAPI function:
   - load PDF
   - split into chunks
   - embed chunks
   - upsert embeddings + metadata into Chroma
4. User asks a question in Streamlit
5. Streamlit sends `rag/query_pdf_ai` event
6. Inngest invokes query function:
   - embed question
   - search Chroma top-k chunks
   - build context prompt
   - generate answer via Ollama
7. Streamlit polls Inngest run output and displays answer + sources

## 4) Core files and responsibilities

- `main.py`
  - Inngest function definitions (`rag/ingest_pdf`, `rag/query_pdf_ai`)
  - provider switch for generator (`LLM_PROVIDER`)
  - FastAPI + Inngest serving

- `data_loader.py`
  - PDF load/chunk
  - embeddings provider switch (`EMBED_PROVIDER`)
  - test-mode deterministic behavior (`RAG_TEST_MODE=1`)

- `vector_db.py`
  - Chroma wrapper (`upsert`, `search`)

- `streamlit_app.py`
  - upload page + ask form
  - send events
  - poll run output

- `scripts/run-api.bat` / `scripts/run-api.ps1`
  - runs FastAPI/uvicorn

- `scripts/run-inngest.bat` / `scripts/run-inngest.ps1`
  - runs Inngest dev server via CLI

## 5) Environment variables

Current local configuration in `.env`:

- `EMBED_PROVIDER=ollama`
- `LLM_PROVIDER=ollama`
- `OLLAMA_BASE_URL=http://127.0.0.1:11434`
- `OLLAMA_EMBED_MODEL=nomic-embed-text`
- `OLLAMA_MODEL=qwen2.5:14b`
- `OPENAI_API_KEY=...` (optional if using Ollama only)

Other behavior flags:

- `RAG_TEST_MODE=1`
  - avoids real providers and uses deterministic local paths
  - useful for testing when provider access is unavailable

## 6) Recreate from scratch (step-by-step)

### A) Install prerequisites

- Python and virtual environment tooling
- Node.js (for `npx inngest-cli`)
- Ollama for Windows

### B) Clone and install dependencies

```powershell
git clone <your-repo-url>
cd ai-agent-youtube
uv sync
```

### C) Ensure Ollama works in terminal

If `ollama` is not recognized:

```powershell
$env:Path += ";C:\Users\ahmed\AppData\Local\Programs\Ollama"
ollama --version
```

Pull required models:

```powershell
ollama pull nomic-embed-text
ollama pull qwen2.5:14b
```

### D) Clear vector store if embedding model changed

```powershell
Remove-Item -Recurse -Force .\chroma_data -ErrorAction SilentlyContinue
```

### E) Start all services (3 terminals)

Terminal 1 (API):

```powershell
.\scripts\run-api.bat
```

Terminal 2 (Inngest):

```powershell
.\scripts\run-inngest.bat
```

Terminal 3 (Streamlit):

```powershell
.\.venv\Scripts\python.exe -m streamlit run streamlit_app.py --server.port 8501
```

Open:

- `http://localhost:8501`

## 7) Runtime flow details

### Ingest function (`rag/ingest_pdf`)

- Input event data:
  - `pdf_path`
  - `source_id`
- Steps:
  - `load-and-chunk`
  - `embed-and-upsert`
- Output:
  - `{ "ingested": <num_chunks> }`

### Query function (`rag/query_pdf_ai`)

- Input event data:
  - `question`
  - `top_k` (default 5)
- Steps:
  - `embed-and-search`
  - `ollama-answer` (or OpenAI path if configured)
- Output:
  - `{ "answer": "...", "sources": [...], "num_contexts": <int> }`

## 8) Testing strategy

- `tests/test_vector_db.py`: validates Chroma upsert/search correctness
- `tests/test_rag_pipeline_e2e.py`: deterministic end-to-end pipeline in-process
- `tests/test_end_to_end_inngest.py`: optional heavier integration test
  - run with `RUN_INNGEST_E2E=1`

Run tests:

```powershell
.\.venv\Scripts\pytest.exe -q
```

## 9) Common issues and fixes

### Error: `ConnectionRefusedError` to `127.0.0.1:11434`

Cause: Ollama not running or not reachable.

Fix:

- start Ollama app/service
- verify with `curl http://127.0.0.1:11434/api/tags`

### Empty answer / no contexts

Cause:
- ingestion didn’t complete
- vector store is empty
- old vectors incompatible with new embedding model

Fix:
- re-upload PDF
- clear `chroma_data/` and ingest again

### Inngest function stuck/running

Cause:
- API or Inngest service not running correctly

Fix:
- restart both services
- verify API on `http://127.0.0.1:8000`
- verify Inngest on `http://127.0.0.1:8288`

## 10) How to extend

- Add reranking (post-retrieval) for better precision
- Add metadata filters by document/source
- Support multiple collections/workspaces
- Add ingestion status in Streamlit UI
- Add citations with chunk text excerpts and score

