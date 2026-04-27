# chatbot-api Operations

## Local Setup

From monorepo root:

```bash
npm run setup --workspace=chatbot-api
npm run dev --workspace=chatbot-api
```

Default address: `http://127.0.0.1:8001`.

## Environment Variables

From `apps/chatbot-api/.env.example` and config:

- Runtime: `APP_ENV`, `APP_HOST`, `APP_PORT`, `LOG_LEVEL`
- Provider: `MODEL_PROVIDER` (`openai` or `ollama`)
- OpenAI: `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL`, `OPENAI_EMBED_MODEL`
- Ollama: `OLLAMA_BASE_URL`, `OLLAMA_CHAT_MODEL`, `OLLAMA_EMBED_MODEL`, `OLLAMA_TIMEOUT_SECONDS`, `OLLAMA_GENERATE_TIMEOUT_SECONDS`
- RAG store: `CHROMA_PERSIST_DIR`, `CHROMA_COLLECTION`
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
