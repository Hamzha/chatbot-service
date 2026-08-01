# chatbot-api

`chatbot-api` is a FastAPI service for document ingestion and retrieval-augmented generation (RAG), with async execution coordinated by Inngest.

## Responsibilities

- Accept PDF/text ingest requests and index chunks into Chroma.
- Execute query workflows against indexed user sources.
- Emit async jobs/events and expose job status polling.

## When `web` uses this service

With **`USE_CHATBOT_API=true`** in `apps/web`, the dashboard and widget use **`chatbot-api`** for chat, PDF ingest, scrape→text ingest, and vector list/delete.

With **`USE_CHATBOT_API=false`**, `web` uses **`model-gateway-api`** instead; you do not need this service running for RAG in that mode.

## Out of Scope

- Frontend session/UI concerns (handled by `web`).
- Scraping and crawling logic (handled by `webscraper`).

## Runtime

- Port: `8001`
- Framework: FastAPI
- Language: Python

Optional **`monorepo/.env.shared`** supplies shared embedding and Chroma defaults; see [Operations](./operations.md).

## Related Docs

- [Architecture](./architecture.md)
- [API](./api.md)
- [Operations](./operations.md)
