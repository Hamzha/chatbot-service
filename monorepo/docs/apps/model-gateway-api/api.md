# model-gateway-api API

Base path prefix is `/api`.

## Core

- `GET /` - welcome message.
- `GET /api/health` - service health.

## Chat

- `POST /api/chat/completions`
  - Chat completion endpoint.
  - Supports direct completion and RAG-backed completion (when `user_id` is present).
  - Returns `400` for invalid model or malformed payload.
  - Returns `502` for provider/runtime failures.

## RAG

- `POST /api/rag/ingest` - ingest PDF via multipart/form fields (`file`, `user_id`, `source_id`).
- `POST /api/rag/ingest-text` - ingest plain text payload.
- `POST /api/rag/query` - query indexed user sources.
- `GET /api/rag/sources?user_id=...` - list source IDs.
- `DELETE /api/rag/sources/{source_id}?user_id=...` - delete source chunks.

## Error Patterns

- `400` validation issues (unsupported model, bad files, invalid body).
- `413` oversized uploads.
- `502` upstream provider failures.
