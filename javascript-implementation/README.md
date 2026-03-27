# JavaScript Implementation (Runnable Slice)

This folder contains the modular Node.js RAG application orchestrated by Inngest, with real PDF ingestion, Ollama embeddings/generation, and ChromaDB vector storage.

## Structure

- `packages/contracts`: DTOs and runtime schemas (Zod).
- `packages/ports`: interfaces for replaceable adapters (retriever, generator, embedder, pdf loader, vector store).
- `packages/core`: application use cases and domain orchestration.
- `apps/api`: Fastify API with Inngest event-driven functions + real adapters.
- `apps/ui`: Vite UI app (upload PDF + chat routes).

## What is implemented

- Monorepo bootstrapped with npm workspaces.
- Contracts-first data objects: `QueryRagInput`, `RetrievedContext`, `QueryRagOutput`, `ChatTurn`, `SearchResult`.
- Port interfaces for PDF loading, embedding, vector storage, retrieval, and generation.
- Real adapters (no mocks):
  - **PdfParseAdapter** — extracts text from PDFs using `pdf-parse`, splits into overlapping chunks.
  - **OllamaEmbedderAdapter** — calls Ollama (`nomic-embed-text`) for text embeddings.
  - **ChromaVectorStoreAdapter** — upserts/queries vectors via ChromaDB server.
  - **OllamaGeneratorAdapter** — calls Ollama (`qwen2.5:7b`) for answer generation.
  - **ChromaRetrieverAdapter** — composes embedder + vector store for retrieval.
- `QueryRagUseCase` vertical slice with history trimming, prompt building, source extraction.
- Inngest orchestration:
  - `rag/ingest-pdf` function (load PDF → chunk → embed → upsert to ChromaDB).
  - `rag/query-pdf` function (embed question → search ChromaDB → generate answer via Ollama).
  - Inngest serve endpoint at `/api/inngest`.
- API routes send Inngest events; UI polls for results.
- File upload via multipart (real PDF bytes saved to `uploads/` directory).
- Environment loaded from root `.env` file via `dotenv`.
- CORS enabled for UI origin.
- Swagger docs at `/docs`.
- Tests: core unit, API integration (mocked Inngest), UI smoke.

---

## Prerequisites

You need the following installed and available before running:

### 1. Node.js (v18+)

Download from [nodejs.org](https://nodejs.org/).

### 2. Ollama

Install [Ollama](https://ollama.ai/) and pull the required models:

```powershell
ollama pull nomic-embed-text
ollama pull qwen2.5:7b
```

Verify Ollama is running:

```powershell
curl http://127.0.0.1:11434
```

### 3. ChromaDB

Install ChromaDB via pip:

```powershell
pip install chromadb
```

### 4. Environment file

The API loads the `.env` file from the **repo root** (one level above `javascript-implementation/`). It should already exist with these values:

```
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_MODEL=qwen2.5:7b
OLLAMA_TIMEOUT_SECONDS=900
```

The JS adapters also support `CHROMA_URL` (default `http://127.0.0.1:8000`), `CHROMA_COLLECTION` (default `docs`), and `UPLOADS_DIR` (default `./uploads`).

---

## Install

From the `javascript-implementation/` folder:

```powershell
cd javascript-implementation
npm install
```

---

## How to run the system

You need **4 terminals** running simultaneously. Open them all from the **repo root** (`ai-agent-youtube/`).

### Terminal 1 — ChromaDB server

```powershell
chroma run --path ./chroma_data --port 8000
```

Wait until you see `Running Chroma` in the output before proceeding.

### Terminal 2 — API server

```powershell
.\scripts\run-js-api.bat
```

Or manually:

```powershell
cd javascript-implementation
npm run dev:api
```

Wait until you see `API running on http://127.0.0.1:4000`.

### Terminal 3 — Inngest dev server

```powershell
.\scripts\run-js-inngest.bat
```

Or manually:

```powershell
npx inngest-cli@latest dev -u http://127.0.0.1:4000/api/inngest
```

Wait until the Inngest dashboard is ready at `http://127.0.0.1:8288`.

### Terminal 4 — UI dev server

```powershell
cd javascript-implementation
npm run dev:ui
```

Wait until you see `Local: http://127.0.0.1:5173/`.

---

## Using the app

### Upload a PDF

1. Open **http://127.0.0.1:5173/upload** in your browser.
2. Click the file input and choose a `.pdf` file.
3. Click **Upload**.
4. Wait for the status to show "Ingestion complete" with the number of chunks ingested.

### Ask questions

1. Navigate to **http://127.0.0.1:5173/chat**.
2. Type a question about the uploaded document.
3. Click **Ask**.
4. Wait for the answer (Ollama generates it using the retrieved context from ChromaDB).

---

## Useful links (while running)

| What | URL |
|---|---|
| UI — Upload | http://127.0.0.1:5173/upload |
| UI — Chat | http://127.0.0.1:5173/chat |
| API — Health check | http://127.0.0.1:4000/health |
| API — Swagger docs | http://127.0.0.1:4000/docs |
| Inngest dashboard | http://127.0.0.1:8288 |
| ChromaDB API | http://127.0.0.1:8000 |
| Ollama API | http://127.0.0.1:11434 |

---

## Validate (typecheck + tests)

```powershell
cd javascript-implementation
npm run typecheck
npm run test
```

---

## Troubleshooting

### `EADDRINUSE: address already in use 127.0.0.1:4000`

A previous API process is still running. Find and kill it:

```powershell
netstat -ano | Select-String ":4000 " | Select-String "LISTENING"
# Note the PID (last column), then:
Stop-Process -Id <PID> -Force
```

### `ChromaConnectionError: Failed to connect to chromadb`

ChromaDB server is not running. Start it in a separate terminal:

```powershell
chroma run --path ./chroma_data --port 8000
```

### `Ollama embedding request failed` or `Ollama generate failed`

Ollama is not running or the required models are not pulled. Check:

```powershell
ollama list
```

If models are missing, pull them:

```powershell
ollama pull nomic-embed-text
ollama pull qwen2.5:7b
```

### `Inngest function run failed`

Open the Inngest dashboard at http://127.0.0.1:8288 and check the function run logs for detailed error messages.
