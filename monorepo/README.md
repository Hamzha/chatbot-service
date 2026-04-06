# Monorepo

## Apps

- `apps/web` - main Next.js app and dashboard UI
- `apps/docs` - documentation app
- `apps/webscraper` - Python web scraper API
- `apps/chatbot-api` - Python chatbot API (FastAPI + Inngest + Chroma)

## Setup

```powershell
npm run setup
```

This installs Node dependencies and sets up Python virtual environments for:

- `webscraper`
- `chatbot-api`

## Chatbot runtime

For chatbot features in `apps/web` (`Upload Document` and `Chatbot`) you need both:

1. Chatbot API
2. Inngest dev server

Run in separate terminals:

```powershell
npm run dev:chatbot-api
npm run dev:chatbot-inngest
```

Optional:

- `npm run dev` to start all workspace `dev` scripts via Turbo.

## Environment variables

- `apps/web/.env.local`:
  - `NEXT_PUBLIC_CHATBOT_API_BASE_URL=http://127.0.0.1:8001`
- `apps/chatbot-api/.env`:
  - copy from `.env.example` and configure provider/model keys
