# web Operations

## Local Setup

From monorepo root:

```bash
npm install
npm run dev --workspace=web
```

Server runs on `http://localhost:3000`.

## Backend toggle (`USE_CHATBOT_API`)

One flag selects the Python service for **chat**, **ingest**, **scrape→vectors**, and **vector deletes**. There is no separate ingest service.

| `USE_CHATBOT_API` | Service | Port (default) |
| --- | --- | --- |
| `true` | `chatbot-api` | 8001 |
| `false` | `model-gateway-api` | 8003 |

Routing is implemented in `apps/web/lib/chatbot/ragService.ts` (`getRagServiceBaseUrl()`).

### Option A — model-gateway only (simplest)

```env
USE_CHATBOT_API=false
MODEL_GATEWAY_API_URL=http://127.0.0.1:8003
```

Run `npm run dev` from monorepo (includes model-gateway). **No** chatbot-api or Inngest for RAG.

### Option B — chatbot-api + Inngest

```env
USE_CHATBOT_API=true
CHATBOT_API_URL=http://127.0.0.1:8001
```

Run `npm run dev` and, in a second terminal, `npm run dev:chatbot-inngest` for **PDF** ingest and async dashboard chat.

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
- **`USE_CHATBOT_API`** — selects backend for chat + RAG (optional `NEXT_PUBLIC_USE_CHATBOT_API` for widget defaults)

Backend integration (see also root **`README.md`**):

- **`CHATBOT_API_URL`** (default `http://127.0.0.1:8001`) — used when **`USE_CHATBOT_API=true`** for chat, ingest, sources, scrape→text.
- **`MODEL_GATEWAY_API_URL`** (default `http://127.0.0.1:8003`) — used when **`USE_CHATBOT_API=false`** for the same flows via `/api/chat/completions` and `/api/rag/*`.
- **`NEXT_PUBLIC_CHATBOT_API_BASE_URL`** / **`NEXT_PUBLIC_MODEL_GATEWAY_API_BASE_URL`** — optional client fallbacks.
- **`SCRAPER_API_URL`** (default `http://localhost:8000`)

**`monorepo/.env.shared`** is not loaded by `web`, but both Python apps use it for **`CHROMA_*`** and **`EMBEDDING_*`**. Keep those aligned so both backends read the same index and compatible vectors.

## Knowledge base and scraper library

- **Mongo** stores `ChatbotDocument` rows (uploads + **site** rows that aggregate many crawled pages).
- **Chroma** stores vectors (shared directory; see `.env.shared`).
- Per-page scrape/crawl sources use the **page URL** as the Chroma `source` id.
- **`GET /api/chatbot/documents`**: returns Mongo rows; if the user has **zero** documents, the route may **backfill** from the **active RAG backend’s** sources API using **non-URL** source ids only.
- **`DELETE /api/chatbot/documents/[id]`**: deletes vectors on the **active RAG backend**, then removes Mongo rows. Site deletes may discover same-origin URL sources still in Chroma.

## Synthetic jobs (model-gateway path)

When **`USE_CHATBOT_API=false`**, sync upstream responses are wrapped as pollable jobs:

- Chat: `mgwq_*` (query)
- PDF ingest: `mgwi_*` (ingest)

`GET /api/chatbot/jobs/{eventId}` resolves these in-process or proxies to chatbot-api Inngest for real event ids.

## Validation Commands

```bash
npm run lint --workspace=web
npm run check-types --workspace=web
npm run test --workspace=web
```

## Common Issues

- 401/403 on API routes: verify JWT, role permissions, and route-level permission identifiers.
- 502 from chatbot/scraper routes: verify the **active** backend is running and env URLs match **`USE_CHATBOT_API`**.
- Empty chatbot results: ensure session has selected documents and indexed source IDs.
- Vectors missing after switch toggle: re-ingest or ensure **`EMBEDDING_*`** matches in `.env.shared` for both backends.
