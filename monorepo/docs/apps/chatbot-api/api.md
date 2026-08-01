# chatbot-api API

Base path is `/v1`.

## Health

- `GET /v1/health` - returns status and selected model provider.

## Ingest

- `POST /v1/ingest`
  - Multipart upload endpoint for PDF.
  - Requires `x-user-id`.
  - Optional `x-rag-source-id` to control source key.
- `POST /v1/ingest-text`
  - Ingests plain text with explicit `source_id`.
  - Requires authenticated user context.

## Query

- `POST /v1/query` - async event-based query; returns `event_ids`.
- `POST /v1/query/sync` - synchronous query; returns direct answer payload.
- `GET /v1/jobs/{event_id}` - checks event run status and output.

## Source Management

- `GET /v1/sources` - list user sources.
- `DELETE /v1/sources/{source_id}` - remove indexed source chunks.

## Error Patterns

- `400` validation/request errors (missing PDF, malformed payload, etc.).
- `413` upload exceeds `max_upload_size_bytes`.
- `502` upstream Inngest status fetch issues.
- `500` unified JSON error response with `request_id`.
