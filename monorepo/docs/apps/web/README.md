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

- `chatbot-api` for async ingest/query flow.
- `model-gateway-api` for direct/fallback chat flow when chatbot API is disabled.
- `webscraper` for scrape and crawl operations.

## Related Docs

- [Architecture](./architecture.md)
- [API Routes](./api.md)
- [Operations](./operations.md)
