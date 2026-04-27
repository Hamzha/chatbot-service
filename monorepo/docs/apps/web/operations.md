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
- `USE_CHATBOT_API`

Additional backend integration vars used in code:

- `CHATBOT_API_URL` (default `http://127.0.0.1:8001`)
- `MODEL_GATEWAY_API_URL` (default `http://127.0.0.1:8003`)
- `SCRAPER_API_URL` (default `http://localhost:8000`)

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
