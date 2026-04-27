# chatbot-api

`chatbot-api` is a FastAPI service for document ingestion and retrieval-augmented generation (RAG), with async execution coordinated by Inngest.

## Responsibilities

- Accept PDF/text ingest requests and index chunks into Chroma.
- Execute query workflows against indexed user sources.
- Emit async jobs/events and expose job status polling.

## Out of Scope

- Frontend session/UI concerns (handled by `web`).
- Scraping and crawling logic (handled by `webscraper`).

## Runtime

- Port: `8001`
- Framework: FastAPI
- Language: Python

## Related Docs

- [Architecture](./architecture.md)
- [API](./api.md)
- [Operations](./operations.md)
