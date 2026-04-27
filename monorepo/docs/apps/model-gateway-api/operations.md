# model-gateway-api Operations

## Local Setup

From monorepo root:

```bash
npm run setup --workspace=model-gateway-api
npm run dev --workspace=model-gateway-api
```

Default docs URL: `http://127.0.0.1:8003/docs`.

## Environment Variables

From `apps/model-gateway-api/.env.example` and config:

- `APP_NAME`
- `APP_ENV`
- `APP_VERSION`
- `API_PREFIX`
- `OPEN_ROUTER_API_KEY`
- `DEFAULT_MODEL`
- `OPEN_ROUTER_EMBED_MODEL`

Additional config defaults:

- `OPEN_ROUTER_BASE_URL` (default OpenRouter API URL)
- `CHROMA_PERSIST_DIR`
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
- If embedding fails, verify `OPEN_ROUTER_EMBED_MODEL` is valid for your account.
- For local parity with `web`, ensure `MODEL_GATEWAY_API_URL` points to this service.
