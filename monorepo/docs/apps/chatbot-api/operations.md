# chatbot-api Operations

## Local Setup

From monorepo root:

```bash
npm run setup --workspace=chatbot-api
npm run dev --workspace=chatbot-api
```

Default address: `http://127.0.0.1:8001`.

## Environment Variables

Load order: **`monorepo/.env.shared`** (if present), then **`apps/chatbot-api/.env`**, then **`.env.local`** — later files override earlier keys. Copy shared defaults from **`monorepo/.env.shared.example`**.

From `apps/chatbot-api/.env.example` and config:

- Runtime: `APP_ENV`, `APP_HOST`, `APP_PORT`, `LOG_LEVEL`
- Chat: `MODEL_PROVIDER` (`openai` or `ollama`)
- Embeddings: **`EMBEDDING_BACKEND`** — `ollama` | `openrouter` | `openai`, or **omit** to mirror `MODEL_PROVIDER` (`openai` / `ollama` only). See `.env.example` for OpenRouter vs Ollama vs OpenAI embedding variables (`OPENROUTER_EMBEDDING_MODEL`, `EMBEDDING_MODEL`, `OLLAMA_EMBEDDING_MODEL`, etc.).
- OpenAI: `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL`, `EMBEDDING_MODEL` (or legacy `OPENAI_EMBED_MODEL`)
- Ollama: `OLLAMA_BASE_URL`, `OLLAMA_CHAT_MODEL`, `OLLAMA_EMBED_MODEL`, `OLLAMA_TIMEOUT_SECONDS`, `OLLAMA_GENERATE_TIMEOUT_SECONDS`
- OpenRouter (embeddings when `EMBEDDING_BACKEND=openrouter`): `OPEN_ROUTER_API_KEY`, `OPEN_ROUTER_BASE_URL`, `OPENROUTER_EMBEDDING_MODEL` (or `EMBEDDING_MODEL`)
- RAG store: `CHROMA_PERSIST_DIR`, `CHROMA_COLLECTION` (defaults point at monorepo `chroma_data` when unset)
- Auth: `AUTH_JWT_SECRET`, `SERVICE_API_KEY`
- Inngest: `INNGEST_APP_ID`, `INNGEST_API_BASE_URL`, `INNGEST_EVENT_API_BASE_URL`

## Validation Commands

```bash
npm run lint --workspace=chatbot-api
npm run check-types --workspace=chatbot-api
npm run test --workspace=chatbot-api
```

## Operational Notes

- In production, openai mode requires `OPENAI_API_KEY`.
- In production, at least one of `AUTH_JWT_SECRET` or `SERVICE_API_KEY` is required.
- Uploads are written to local `uploads/` and size-limited.
- Inngest must be reachable for async query/ingest paths.
- **Embedding vector size** must match the collection: changing **`EMBEDDING_BACKEND`** or models usually requires re-ingesting or wiping Chroma.
