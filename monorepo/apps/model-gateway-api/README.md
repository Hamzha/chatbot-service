# Model Gateway API

Minimal FastAPI boilerplate for learning step by step.

This starter keeps only the essentials so you can build features one by one.

## Quick start

1. Copy .env.example to .env
2. Run npm run setup
3. Run npm run dev
4. Open http://127.0.0.1:8003/docs

## Environment notes

- `DEFAULT_MODEL`: chat/completion model (free models are enforced by service logic)
- `OPEN_ROUTER_EMBED_MODEL`: embedding model used by RAG ingest/query
- If you get provider embedding errors, verify the embedding model slug exists for your OpenRouter key.

Current project usage expects a free embedding model configured in `.env` via `OPEN_ROUTER_EMBED_MODEL`.

## Scripts

- npm run setup: create venv and install dependencies
- npm run dev: run FastAPI with autoreload
- npm run test: run tests
- npm run lint: run Ruff
- npm run start: production-style run

## Included endpoints

- GET /: welcome message
- GET /api/health: health check
- POST /api/chat/completions: stub chat completion endpoint
