# Decision: Colocated RAG Ingest + Shared Chroma

**Status:** Accepted (supersedes [keep-rag-ingest-in-chatbot-api.md](./keep-rag-ingest-in-chatbot-api.md))  
**Date:** 2026-06-02

## Decision

- **`chatbot-api`** and **`model-gateway-api`** each expose their own ingest/query/sources APIs (no separate ingest service).
- **`web`** routes ingest, scrape→vectors, and vector deletes through **`USE_CHATBOT_API`** (same toggle as chat).
- Both backends use the **same Chroma directory and collection** via **`monorepo/.env.shared`** (`CHROMA_PERSIST_DIR`, `CHROMA_COLLECTION`).

## Runtime

| `USE_CHATBOT_API` | Chat | PDF ingest | Text ingest (scraper) | Sources / delete |
| --- | --- | --- | --- | --- |
| `true` | `chatbot-api` + Inngest jobs | `POST /v1/ingest` → Inngest | `POST /v1/ingest-text` sync | `/v1/sources` |
| `false` | `model-gateway-api` sync | `POST /api/rag/ingest` sync | `POST /api/rag/ingest-text` sync | `/api/rag/sources` |

With **`USE_CHATBOT_API=false`**, you do **not** need Inngest or `chatbot-api` running for ingest—only **`model-gateway-api`** + **`web`**.

With **`USE_CHATBOT_API=true`**, PDF ingest still uses **Inngest** on `chatbot-api`; run `npm run dev:chatbot-inngest` for async PDF jobs.

## Shared Chroma

Defaults (both apps):

- `CHROMA_PERSIST_DIR` → `monorepo/chroma_data` (relative paths resolved from monorepo root)
- `CHROMA_COLLECTION` → `chatbot_chunks`

**Embedding model and backend must match** across both services if you ever switch the toggle; otherwise re-ingest after changing `EMBEDDING_*` in `.env.shared`.

## Implementation

- Web helper: `apps/web/lib/chatbot/ragService.ts`
- Synthetic ingest jobs when using model-gateway PDF ingest: `mgwi_*` prefix in `syntheticQueryJobs.ts`

## Documentation

- Root runbook: [`../../README.md`](../../README.md) — **RAG & ingest routing**, Flow C, env examples
- Hub: [`../README.md`](../README.md)
- Per app: [`../apps/web/operations.md`](../apps/web/operations.md), [`../apps/chatbot-api/operations.md`](../apps/chatbot-api/operations.md), [`../apps/model-gateway-api/operations.md`](../apps/model-gateway-api/operations.md), [`../apps/webscraper/operations.md`](../apps/webscraper/operations.md)
