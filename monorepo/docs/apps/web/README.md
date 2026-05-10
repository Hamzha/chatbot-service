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

- **`chatbot-api`** — always the target for **ingest**, **scrape/crawl text indexing**, **source list/delete** used by document APIs (`CHATBOT_API_URL` / `NEXT_PUBLIC_CHATBOT_API_BASE_URL`). Dashboard **chat** also uses it when **`USE_CHATBOT_API=true`**.
- **`model-gateway-api`** — dashboard **chat** when **`USE_CHATBOT_API=false`** (sync + synthetic jobs).
- **`webscraper`** — scrape and crawl HTTP service; results are persisted and forwarded to **`chatbot-api`** for embeddings.

## Related Docs

- [Architecture](./architecture.md)
- [API Routes](./api.md)
- [Operations](./operations.md)
