# web Architecture

## High-Level Components

- `app/` - App Router pages and route handlers.
- `components/` - UI components and feature-level clients.
- `lib/auth` - Auth, permission checks, and RBAC enforcement.
- `lib/db` - Data repositories for MongoDB-backed entities.
- `lib/chatbot` - Upstream proxy and service-selection helpers.
- `lib/scraper` - Crawl worker orchestration and scrape ingestion mapping.

## Query Flow

```mermaid
sequenceDiagram
    participant Browser
    participant WebAPI as web/api/chatbot/query
    participant DB as Mongo
    participant Chatbot as chatbot-api
    participant Gateway as model-gateway-api

    Browser->>WebAPI: POST question + sessionId
    WebAPI->>DB: Load session + selected rag keys
    WebAPI->>DB: Load prior messages
    alt USE_CHATBOT_API = true
        WebAPI->>Chatbot: POST /v1/query (x-user-id)
        Chatbot-->>WebAPI: event_ids
    else USE_CHATBOT_API = false
        WebAPI->>Gateway: POST /api/chat/completions
        Gateway-->>WebAPI: output_text + sources
        WebAPI-->>WebAPI: create synthetic job id
    end
    WebAPI-->>Browser: event_ids for polling
```

## Scraper Flow

```mermaid
sequenceDiagram
    participant Browser
    participant WebAPI as web/api/scraper/*
    participant Scraper as webscraper
    participant DB as Mongo
    participant Chatbot as chatbot-api

    Browser->>WebAPI: POST scrape/crawl request
    WebAPI->>Scraper: call /api/v1/scrape or /api/v1/crawl/stream
    Scraper-->>WebAPI: structured text / stream events
    WebAPI->>DB: persist job progress and metadata
    WebAPI->>Chatbot: ingest text for retrieval
    WebAPI-->>Browser: response + ingestion metadata
```

## Security and Control Points

- Route-level permission gates via `requireUserIdWithPermission(...)`.
- Per-user rate limiting on high-cost routes.
- Service calls normalized through helper utilities for consistent upstream error handling.
