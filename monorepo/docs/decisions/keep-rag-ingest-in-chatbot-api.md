# Decision: Do Not Merge Ingest Into Both Backends

**Status:** Superseded by [rag-ingest-per-backend-shared-chroma.md](./rag-ingest-per-backend-shared-chroma.md)  
**Date:** 2026-06-02  
**Context:** We considered colocating RAG ingest inside both `chatbot-api` and `model-gateway-api` (instead of treating ingest as a separate concern or routing it differently per backend).

## Decision

**Keep the current architecture.** Do not merge or duplicate ingest flows across both Python backends. Continue with:

- **`chatbot-api`** — canonical ingest path for the platform (PDF upload, scraped text, source list/delete).
- **`model-gateway-api`** — chat/query when `USE_CHATBOT_API=false`; RAG endpoints remain available but are not the primary ingest path for `web`.
- **`webscraper`** — scraping/crawling only; downstream text still goes to `chatbot-api` for vectorization.

## Current Layout (unchanged)

```text
web
├── chat/query     → chatbot-api OR model-gateway-api  (USE_CHATBOT_API toggle)
├── ingest/KB      → chatbot-api always                 (CHATBOT_API_URL)
└── scrape/crawl   → webscraper → chatbot-api ingest-text
```

Both backends may share the same Chroma directory and collection via `monorepo/.env.shared`, but **writes for production ingest go through `chatbot-api` only**.

## Reasons We Are Not Merging

### 1. There is no standalone ingest service to remove

Ingest is already embedded in `chatbot-api` (orchestrated by Inngest). `model-gateway-api` also has RAG ingest endpoints, but the web app does not use them for dashboard uploads or scraper pipelines. “Merging ingest into both services” would mostly mean **copying the same logic twice**, not simplifying deployment.

### 2. Single write path avoids index inconsistency

If ingest followed the same toggle as chat (`USE_CHATBOT_API`), users could upload documents while on one backend and query while on the other. Both apps talk to Chroma, but embedding provider, model slug, and runtime can differ. Routing all ingest to `chatbot-api` guarantees one consistent writer and one job/status contract for the UI.

### 3. Async ingest is a feature, not accidental complexity

`chatbot-api` uses Inngest for PDF and text ingest:

- Large PDFs and slow embedding calls do not block HTTP requests.
- Retries, throttling, and job polling (`event_ids` → `/v1/jobs/{id}`) already power the dashboard upload and scraper flows.

`model-gateway-api` ingest is synchronous. Moving platform ingest there would either lose that behavior or require re-building background jobs in a second place.

### 4. Duplicating ingest in both services increases maintenance cost

`chatbot-api` and `model-gateway-api` already contain nearly identical RAG engine code (chunk, embed, upsert, query). Maintaining **two active ingest codepaths** in production means:

- Bug fixes and behavior changes must land twice.
- Embedding/chunking rules can drift between services.
- Tests and ops runbooks multiply without clear user benefit.

Keeping **one canonical ingest owner** is simpler than “each service owns its own ingest.”

### 5. The two backends serve different primary roles

| Service | Primary job |
| --- | --- |
| `chatbot-api` | Async RAG platform API (ingest, query, sources, Inngest jobs); supports Ollama/OpenAI/OpenRouter-style configs. |
| `model-gateway-api` | Sync OpenRouter chat gateway with optional RAG; used when the web app wants immediate responses and synthetic job IDs for UI compatibility. |

Conflating “ingest owner” with “chat owner” would tie document pipeline changes to the chat routing toggle, which are unrelated product concerns.

### 6. Shared storage already gives us the important coupling

Both apps can read/write the same Chroma data when configured via `.env.shared` (`CHROMA_PERSIST_DIR`, `CHROMA_COLLECTION`, aligned embedding settings). We get **shared knowledge** without **duplicated ingest services**. That is the right level of sharing for now.

### 7. webscraper should stay separate

Scraping (HTTP fetch, Playwright, crawl streaming) is I/O-heavy and security-sensitive (SSRF, rate limits). Vectorization (chunk + embed + upsert) belongs with the RAG API. Merging scraper into either Python backend would blur boundaries and make scaling/deploy harder.

## What We Will Not Do (for now)

- Route dashboard ingest or scraper `ingest-text` through `model-gateway-api` based on `USE_CHATBOT_API`.
- Extract a shared Python RAG package **only** to enable duplicate ingest in both services (a shared library may still make sense later for DRY, but not as a reason to split ingest ownership).
- Introduce a fifth standalone “ingest microservice.”

## When to Revisit

Re-open this decision if:

- We permanently retire `chatbot-api` and standardize on `model-gateway-api` for all RAG.
- We need ingest to follow the chat backend toggle for multi-tenant isolation (separate Chroma per backend).
- Ingest volume or latency forces a dedicated worker service (queue + workers) decoupled from both APIs.
- We unify on one backend and delete the other, making “merge ingest” a non-issue.

## Related Docs

- [`monorepo/README.md`](../../README.md) — platform overview and routing toggle
- [`apps/chatbot-api/architecture.md`](../apps/chatbot-api/architecture.md) — Inngest ingest/query flows
- [`apps/model-gateway-api/architecture.md`](../apps/model-gateway-api/architecture.md) — sync RAG endpoints
