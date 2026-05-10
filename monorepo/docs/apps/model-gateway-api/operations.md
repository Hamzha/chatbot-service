# model-gateway-api Operations

## Local Setup

From monorepo root:

```bash
npm run setup --workspace=model-gateway-api
npm run dev --workspace=model-gateway-api
```

Default docs URL: `http://127.0.0.1:8003/docs`.

## Environment Variables

Load order: **`monorepo/.env.shared`** (if present), then **`apps/model-gateway-api/.env.local`** — local overrides shared. Copy shared defaults from **`monorepo/.env.shared.example`**.

From `apps/model-gateway-api/.env.example` and config:

- `APP_NAME`
- `APP_ENV`
- `APP_VERSION`
- `API_PREFIX`
- `OPEN_ROUTER_API_KEY`
- `DEFAULT_MODEL`
- **`EMBEDDING_BACKEND`** — `openrouter` | `ollama` (RAG embeddings only; chat still uses OpenRouter completions)
- **`EMBEDDING_MODEL`** — OpenRouter embedding model slug when backend is `openrouter`
- **`OLLAMA_BASE_URL`**, **`OLLAMA_EMBEDDING_MODEL`** — when backend is `ollama`

Additional config defaults:

- `OPEN_ROUTER_BASE_URL` (default OpenRouter API URL)
- `CHROMA_PERSIST_DIR` (default: monorepo `chroma_data`)
- `CHROMA_COLLECTION`
- `MAX_UPLOAD_SIZE_BYTES`

## Validation Commands

```bash
npm run lint --workspace=model-gateway-api
npm run check-types --workspace=model-gateway-api
npm run test --workspace=model-gateway-api
```

## Operational Notes

- Ensure `OPEN_ROUTER_API_KEY` has access to configured chat and embedding models.
- If embedding fails, verify **`EMBEDDING_BACKEND`** and the matching model vars (`EMBEDDING_MODEL` vs `OLLAMA_EMBEDDING_MODEL`).
- Use **`monorepo/.env.shared`** to keep **`CHROMA_COLLECTION`** (and optionally persist dir) aligned with **`chatbot-api`** when both services read the same index.
- For local parity with `web`, ensure `MODEL_GATEWAY_API_URL` points to this service.
