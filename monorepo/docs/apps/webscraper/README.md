# webscraper

`webscraper` is a FastAPI microservice that scrapes static/dynamic web content and streams crawl progress.

## Responsibilities

- Single-page scrape in static, dynamic, or auto-detect mode.
- Site crawl with bounded page/depth limits.
- Structured extraction for downstream ingestion.

## Out of Scope

- Chat/RAG generation.
- Frontend session and user management.

## Runtime

- Port: `8000`
- Framework: FastAPI
- Language: Python

## Related Docs

- [Architecture](./architecture.md)
- [API](./api.md)
- [Operations](./operations.md)
