# chatbot-api Architecture

## Core Modules

- `app/main.py` - FastAPI app, route handlers, Inngest function wiring, exception mapping.
- `app/engine.py` - use-case orchestration for ingest/query.
- `app/vector_store.py` - Chroma-backed storage access.
- `app/providers/*` - model provider clients and provider selection.
- `app/auth.py` - authenticated user resolution.
- `app/contracts.py` - request/response contract models.

## Ingest Flow (PDF)

```mermaid
sequenceDiagram
    participant Web as web
    participant API as chatbot-api /v1/ingest
    participant FS as uploads/
    participant Inngest
    participant Engine as IngestPdfUseCase
    participant Chroma

    Web->>API: multipart file + x-user-id + x-rag-source-id
    API->>FS: stream file with max-size guard
    API->>Inngest: emit chatbot/ingest_pdf
    Inngest->>Engine: run ingest step
    Engine->>Chroma: embed + persist chunks
```

## Query Flow

```mermaid
sequenceDiagram
    participant Web as web
    participant API as chatbot-api /v1/query
    participant Inngest
    participant Engine as QueryRagUseCase
    participant Chroma
    participant Provider as OpenAI/Ollama

    Web->>API: question + source_ids + context
    API->>Inngest: emit chatbot/query
    Inngest->>Engine: run query step
    Engine->>Chroma: retrieve relevant contexts
    Engine->>Provider: generate grounded answer
```

## Key Design Notes

- Async and sync query endpoints both exist (`/v1/query`, `/v1/query/sync`).
- Error handling returns JSON with stable shape, including a request ID on 500s.
- Auth context is passed from `web` via `x-user-id` and validated server-side.
