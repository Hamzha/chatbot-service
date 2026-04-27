# model-gateway-api Architecture

## Core Modules

- `app/main.py` - FastAPI app bootstrap and router inclusion.
- `app/api/router.py` - route registration (`health`, `chat`, `rag`).
- `app/services/chat_service.py` - chat completion and RAG orchestration.
- `app/providers/openrouter_provider.py` - model and embedding provider calls.
- `app/rag/*` - ingest/query use cases and Chroma vector storage.
- `app/core/config.py` - env and allowed free model configuration.

## Completion Flow

```mermaid
sequenceDiagram
    participant Web as web
    participant API as model-gateway /api/chat/completions
    participant Service as ChatService
    participant Provider as OpenRouter

    Web->>API: messages (+ optional user_id)
    API->>Service: create_chat_completion
    alt payload has user_id
        Service->>Service: build RagQueryRequest
        Service->>Provider: embed + generate through RAG use-case
    else no user_id
        Service->>Provider: direct chat completion
    end
    API-->>Web: output_text (+ sources when RAG path used)
```

## RAG Ingest/Query Flow

```mermaid
flowchart LR
    A[/api/rag/ingest or ingest-text/] --> B[Use Case]
    B --> C[(Chroma Vector Store)]
    D[/api/rag/query/] --> E[Retrieve Top-K Contexts]
    E --> F[OpenRouter Generation]
    F --> G[Answer + Source IDs]
```

## Key Design Notes

- Chat service enforces `FREE_MODELS` from config for model selection.
- RAG can be triggered from chat completions when `user_id` is supplied.
- Chroma store location defaults to a monorepo-level `chroma_data` directory.
