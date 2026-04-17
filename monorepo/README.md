# Monorepo

## Apps

- `apps/web` - main Next.js app and dashboard UI
- `apps/docs` - documentation app
- `apps/webscraper` - Python web scraper API
- `apps/chatbot-api` - Python chatbot API (FastAPI + Inngest + Chroma)

## Setup

From this directory (`monorepo/`):

```powershell
npm run setup
```

This installs Node dependencies and sets up Python virtual environments for:

- `webscraper`
- `chatbot-api`

## Running the system

### Full stack (recommended)

Starts every workspace `dev` script via Turbo (web, docs, chatbot-api, webscraper, etc.):

```powershell
cd monorepo
npm run dev
```

Use the Turbo UI to focus logs per app. Default ports include **web `3000`**, **chatbot-api `8001`**, **webscraper `8000`**, **docs `3001`** (see each app’s `package.json` if you change them).

### Chatbot + Inngest

Upload/query jobs use **Inngest**. With `npm run dev` already running (so **chatbot-api** is on **8001**), open a **second terminal** from `monorepo/`:

```powershell
npm run dev:chatbot-inngest
```

That runs the Inngest dev CLI pointed at `http://127.0.0.1:8001/api/inngest`.

If you are **not** using PowerShell (e.g. Git Bash):

```bash
npx inngest-cli@latest dev -u http://127.0.0.1:8001/api/inngest
```

### Chatbot API only

If you only need the Python service (for example you start `web` elsewhere):

```powershell
npm run dev:chatbot-api
```

## Environment variables

- `apps/web/.env.local`:
  - `CHATBOT_API_URL=http://127.0.0.1:8001` (or `NEXT_PUBLIC_CHATBOT_API_BASE_URL` for the same URL; prefer `127.0.0.1` on Windows if `localhost` causes connection issues)
- `apps/chatbot-api/.env`:
  - copy from `.env.example` and configure provider/model keys
