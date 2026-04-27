# web API Routes

This app exposes internal product APIs for the frontend.

## Auth

- `POST /api/auth/login`
- `POST /api/auth/signup`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/verify-email`
- `POST /api/auth/demo-login`

## Chatbot

- `POST /api/chatbot/ingest` - uploads PDF and proxies to `chatbot-api /v1/ingest`.
- `POST /api/chatbot/query` - executes chatbot query against selected sources.
- `GET /api/chatbot/jobs/[eventId]` - polls job status.
- `GET|POST /api/chatbot/sessions` and `PATCH|DELETE /api/chatbot/sessions/[sessionId]`.
- `GET|POST /api/chatbot/sources` and `DELETE /api/chatbot/sources/[sourceId]`.
- `GET|POST|DELETE /api/chatbot/documents` endpoints.
- Widget endpoints:
  - `GET|POST /api/chatbot/widget/config`
  - `POST /api/chatbot/widget/chat`

## Scraper

- `POST /api/scraper/scrape` - single page scrape through `webscraper`.
- `GET|POST /api/scraper/crawl/jobs` - create and list crawl jobs.
- `GET /api/scraper/crawl/jobs/[jobId]` - crawl job progress/results.

## Admin / RBAC

- `GET|POST /api/admin/users`
- `PATCH|DELETE /api/admin/users/[id]`
- `GET|POST /api/admin/roles`
- `PATCH|DELETE /api/admin/roles/[id]`
- `GET /api/admin/permissions`

## Logging

- `GET /api/logs` - internal log retrieval endpoint.

## Notes

- Most routes enforce permission checks and rate limits.
- Upstream proxy routes normalize non-JSON and network failures into structured 4xx/5xx responses.
