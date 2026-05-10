# web Operations

## Local Setup

From monorepo root:

```bash
npm install
npm run dev --workspace=web
```

Server runs on `http://localhost:3000`.

## Environment Variables

Core values from `apps/web/.env.example`:

- `JWT_SECRET`
- `JWT_EXPIRES_IN_SECONDS`
- `BCRYPT_SALT_ROUNDS`
- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `NEXT_PUBLIC_APP_URL`
- `USE_CHATBOT_API` (optional `NEXT_PUBLIC_USE_CHATBOT_API` for widget-oriented defaults)

Additional backend integration vars used in code:

- **`CHATBOT_API_URL`** (default `http://127.0.0.1:8001`) — used by server routes that call **`chatbot-api`** directly: PDF ingest, **`/v1/ingest-text`** (scraper), **`/v1/sources`**, document delete vector cleanup, etc. **Not** switched by `USE_CHATBOT_API`.
- **`NEXT_PUBLIC_CHATBOT_API_BASE_URL`** — optional; used when `CHATBOT_API_URL` is unset (same semantics).
- **`MODEL_GATEWAY_API_URL`** (default `http://127.0.0.1:8003`) — used when **`USE_CHATBOT_API=false`** for dashboard **`POST /api/chatbot/query`** (and related gateway paths).
- **`NEXT_PUBLIC_MODEL_GATEWAY_API_BASE_URL`** — optional gateway fallback for client/widget code paths that read it.
- `SCRAPER_API_URL` (default `http://localhost:8000`)

Shared Python env for the backends lives at **`monorepo/.env.shared`** (see root **`README.md`** and **`.env.shared.example`**); the web app does not load that file, but ingest/query quality depends on matching embedding config across **`chatbot-api`** and **`model-gateway-api`** when both use Chroma.

## Knowledge base and scraper library

- **Mongo** stores `ChatbotDocument` rows (uploads + **site** rows that aggregate many crawled pages).
- **Chroma** stores vectors; per-page scrape/crawl sources use the **page URL** as the Chroma `source` id.
- **`GET /api/chatbot/documents`**: returns Mongo rows; if the user has **zero** documents, the route may **backfill** from **`GET chatbot-api /v1/sources`** using **non-URL** source ids only (upload-style keys), so empty Mongo after a delete does not resurrect one row per crawled URL.
- **`DELETE /api/chatbot/documents/[id]`**: deletes matching vectors in **chatbot-api**, then removes Mongo rows (including legacy keys). Site deletes also discover **same-origin** URL sources still listed in Chroma when needed.

## Validation Commands

```bash
npm run lint --workspace=web
npm run check-types --workspace=web
npm run test --workspace=web
```

## Common Issues

- 401/403 on API routes: verify JWT, role permissions, and route-level permission identifiers.
- 502 from chatbot/scraper routes: verify dependent services are running and env URLs are correct.
- Empty chatbot results: ensure session has selected documents and indexed source IDs.
