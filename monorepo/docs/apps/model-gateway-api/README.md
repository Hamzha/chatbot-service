# model-gateway-api

`model-gateway-api` is a FastAPI service that provides model completion APIs and direct RAG endpoints.

## Responsibilities

- Serve chat completions through OpenRouter-backed provider logic.
- Offer direct ingest/query/source APIs for RAG workflows.
- Enforce allowed model list for predictable cost/safety.

## When `web` uses this service

With **`USE_CHATBOT_API=false`** in `apps/web`, the dashboard uses **`model-gateway-api`** for:

- Chat (`POST /api/chat/completions`)
- PDF and text ingest (`POST /api/rag/ingest`, `/api/rag/ingest-text`)
- Vector list/delete (`GET` / `DELETE /api/rag/sources`)

No **Inngest** or **`chatbot-api`** is required for that local setup. Ingest is **synchronous**; `web` wraps PDF results in synthetic job ids (`mgwi_*`) for the upload UI.

With **`USE_CHATBOT_API=true`**, RAG ingest from `web` goes to **`chatbot-api`** instead (this service is optional unless you call it directly).

## Out of Scope

- Frontend auth/session behavior (handled by `web`).
- Inngest-based async PDF ingest (that path lives on **`chatbot-api`** when the web toggle is `true`).

## Runtime

- Port: `8003`
- Framework: FastAPI
- Language: Python

Optional **`monorepo/.env.shared`** aligns embedding and Chroma settings with **`chatbot-api`** when both use the same vector store; see [Operations](./operations.md).

## Related Docs

- [Architecture](./architecture.md)
- [API](./api.md)
- [Operations](./operations.md)
