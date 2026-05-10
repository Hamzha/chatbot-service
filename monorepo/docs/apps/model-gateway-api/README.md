# model-gateway-api

`model-gateway-api` is a FastAPI service that provides model completion APIs and direct RAG endpoints.

## Responsibilities

- Serve chat completions through OpenRouter-backed provider logic.
- Offer direct ingest/query/source APIs for RAG workflows.
- Enforce allowed model list for predictable cost/safety.

## Out of Scope

- Frontend auth/session behavior (handled by `web`).
- Event queue orchestration (primary async flow lives in `chatbot-api`).

## Runtime

- Port: `8003`
- Framework: FastAPI
- Language: Python

Optional **`monorepo/.env.shared`** aligns embedding and Chroma settings with **`chatbot-api`** when both use the same vector store; see [Operations](./operations.md).

## Related Docs

- [Architecture](./architecture.md)
- [API](./api.md)
- [Operations](./operations.md)
