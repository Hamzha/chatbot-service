# web

`web` is the primary product application (Next.js) that serves UI pages and backend API routes.

## Responsibilities

- User-facing pages and dashboard experience.
- Authentication and RBAC checks.
- API gateway/facade for chatbot and scraper services.
- Persistence for app-owned data in MongoDB (sessions, messages, crawl jobs, documents, users, roles).

## Out of Scope

- Running LLM providers directly (delegated to backend services).
- Raw scraping logic (delegated to `webscraper`).

## Runtime

- Port: `3000`
- Framework: Next.js App Router
- Language: TypeScript

## Key Integrations

**`USE_CHATBOT_API`** selects one Python backend for **chat** and **RAG** (no separate ingest service):

| Toggle | Service | Chat | Ingest / vectors |
| --- | --- | --- | --- |
| `true` | **`chatbot-api`** | `/v1/query` (Inngest) | `/v1/ingest`, `/v1/ingest-text`, `/v1/sources` |
| `false` | **`model-gateway-api`** | `/api/chat/completions` (sync) | `/api/rag/*` (sync) |

- **`webscraper`** — scrape and crawl; `web` forwards text to the **active** RAG backend for embedding.
- **Shared Chroma** — both Python apps default to `monorepo/chroma_data` via **`monorepo/.env.shared`** (`CHROMA_PERSIST_DIR`, `CHROMA_COLLECTION`, `EMBEDDING_*`).
- **Routing helper** — `apps/web/lib/chatbot/ragService.ts`.

See root [`README.md`](../../../README.md) (section **RAG & ingest routing**) and [`decisions/rag-ingest-per-backend-shared-chroma.md`](../../decisions/rag-ingest-per-backend-shared-chroma.md).

## Related Docs

- [Architecture](./architecture.md)
- [API Routes](./api.md)
- [Operations](./operations.md)
