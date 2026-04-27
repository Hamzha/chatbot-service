# webscraper Operations

## Local Setup

From monorepo root:

```bash
npm run setup --workspace=webscraper
npm run dev --workspace=webscraper
```

Default address: `http://localhost:8000` (docs at `/docs`).

## Environment Variables

From `apps/webscraper/.env.example`:

- `SCRAPER_API_KEY`
- `SCRAPER_ALLOWED_DOMAINS`
- `SCRAPER_REQUEST_TIMEOUT_SECONDS`
- `SCRAPER_PLAYWRIGHT_TIMEOUT_MS`
- `SCRAPER_MAX_CONCURRENT_REQUESTS`
- `SCRAPER_MAX_RETRIES`
- `SCRAPER_RATE_LIMIT_PER_MINUTE`

## Validation Commands

```bash
npm run test --workspace=webscraper
```

Note: lint/check-type scripts are placeholders in this workspace.

## Operational Notes

- Dynamic mode needs Playwright Chromium installed (`npm run install:playwright --workspace=webscraper`).
- Keep `SCRAPER_ALLOWED_DOMAINS` empty for unrestricted local testing, or set strict values for production.
- If consumers use API key auth, ensure they send `X-API-Key`.
