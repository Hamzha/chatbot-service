# Project Context — AI Chatbot Platform

## Overview

This is an AI-powered chatbot platform with authentication, web scraping, and RAG-based PDF Q&A capabilities. The codebase is structured as a monorepo + microservices hybrid.

## Directory Structure

```
chatbot/
├── context.md              ← you are here
├── monorepo/               ← Turborepo monorepo (Next.js apps + shared packages)
│   ├── apps/
│   │   ├── web/            ← Default Next.js app (port 3000)
│   │   ├── docs/           ← Docs app (port 3001)
│   │   └── webscraper/     ← Web scraper (FastAPI + httpx/Playwright, port 8000)
│   └── packages/
│       ├── auth/           ← @repo/auth — shared auth types, validators, hooks, components, lib
│       ├── ui/             ← @repo/ui — shared UI components (Button, Input, Card, etc.)
│       ├── eslint-config/  ← @repo/eslint-config — shared ESLint configs
│       └── typescript-config/ ← @repo/typescript-config — shared tsconfig presets
├── microservices/          ← Standalone microservices (not in Turborepo)
│   ├── auth-service/       ← Auth service (Next.js, port 3002) — not yet moved to monorepo
│   ├── chatbot-service/    ← RAG chatbot (FastAPI + Inngest + Chroma + Streamlit + Ollama)
│   └── webscrapper/        ← Web scraper (original location, now moved to monorepo/apps/webscraper/)
```

## Three Microservices

### 1. Auth Service (Next.js) — still in microservices

- **Location:** `microservices/auth-service/`
- **Tech:** Next.js 16, React 19, MongoDB/Mongoose, JWT (jose), bcryptjs, Resend email, Zod
- **Port:** 3002
- **Features:** Signup, login, logout, email verification, password reset, route protection via proxy.ts
- **Status:** Shared code has been extracted into `@repo/auth` and `@repo/ui` packages, but the auth-service app itself has **not yet been moved** into `monorepo/apps/`. It still runs standalone from `microservices/auth-service/`.
- **Shared packages (ready for wiring):**
  - `@repo/auth` — types, validators, useAuth hook, AuthCard/LoginForm/SignupForm/LogoutButton components, core lib (jwt, password, cookies, tokens, env)
  - `@repo/ui` — FormButton, Input, PasswordInput, FormError

### 2. Chatbot Service (Python)

- **Location:** `microservices/chatbot-service/`
- **Tech:** FastAPI, Inngest, Chroma (vector DB), Streamlit, Ollama (local LLM)
- **Ports:** API 8000, Inngest 8288, Streamlit 8501
- **Features:** PDF upload, ingest into vector store, RAG-based Q&A using local models
- **Models:** nomic-embed-text (embeddings), qwen2.5:14b (generation)
- **Not in Turborepo** — Python service, runs independently

#### Inngest Functions

**1. `rag_ingest_pdf` (event: `rag/ingest_pdf`)**

- Triggers on PDF upload via Streamlit
- Loads PDF → chunks (1000 chars, 200 overlap) → embeds → upserts to Chroma
- Rate limit: 1 per source per 4 hours

**2. `rag_ingest_text_content` (event: `rag/ingest_text_content`)** — NEW

- Triggers on scraped web content from frontend scraper
- Takes raw text → chunks → embeds → upserts to Chroma
- Same pipeline as PDF but handles text directly
- Rate limit: 10 per source per hour
- Used for web scraper integration (see below)

**3. `rag_query_pdf_ai` (event: `rag/query_pdf_ai`)**

- Triggered by Streamlit chat UI
- Takes question → embeds → searches Chroma → generates answer with LLM

#### HTTP Endpoints — NEW

**`POST /api/v1/ingest-text`** — Ingest raw text content

- Accepts: `{ text_content, source_id, title?, url? }`
- Sends async Inngest event for chunking/embedding/storage
- Returns immediately with source_id
- Called by web scraper frontend routes

**`POST /api/v1/query`** — Query vector DB directly

- Accepts: `{ question, top_k? }`
- Embeds question → searches Chroma → returns contexts + sources
- Synchronous (returns immediately with results)
- Used for RAG context retrieval

### 3. Web Scraper Integration — NEW

### 3. Web Scraper Integration — NEW

The web scraper (monorepo frontend scraper routes) now automatically sends scraped content to the chatbot service for vector DB ingestion.

**Flow:**

```
Frontend Scrapes URL
  ↓
monorepo/apps/web/app/api/scraper/scrape/route.ts receives data
  ↓
Route sends text_content to chatbot service
  ↓
POST chatbot:8000/api/v1/ingest-text
  ↓
Chatbot triggers rag_ingest_text_content Inngest event (async)
  ↓
Text chunked → embedded → stored in Chroma
  ↓
Searchable via /api/v1/query or Streamlit UI
```

**Changes to Frontend Routes:**

- **`monorepo/apps/web/app/api/scraper/scrape/route.ts`** — After scraping, sends data to chatbot service (fire-and-forget)
- **`monorepo/apps/web/app/api/scraper/crawl/route.ts`** — For multi-page crawls, sends each page separately with unique source_id

**Benefits:**

- Scraped content instantly available for RAG queries
- No manual PDF upload needed
- Automatic chunking/embedding
- Decoupled async processing via Inngest

### 4. Web Scraper

- **Location:** `monorepo/apps/webscraper/`
- **Original:** `microservices/webscrapper/` (kept as reference)
- **Tech:** FastAPI, httpx + BeautifulSoup (static), Playwright (dynamic)
- **Port:** 8000 (conflicts with chatbot API — use different port if running both)
- **Features:** Single page scrape, recursive crawl (BFS), auto-detection of static vs dynamic sites
- **Security:** SSRF prevention, API key auth, rate limiting
- **In Turborepo** — Python service colocated with npm script wrappers; `turbo run dev` starts it alongside Next.js apps

## Shared Packages (Turborepo)

### @repo/auth (`packages/auth/`)

Shared authentication logic usable by any app in the monorepo.

**Exports:**

- `@repo/auth/types` — LoginInput, SignupInput, AuthResponse, SessionPayload, UserRecord, SafeUser
- `@repo/auth/validators` — Zod schemas: signupSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema
- `@repo/auth/lib/jwt` — signSessionToken, verifySessionToken
- `@repo/auth/lib/password` — hashPassword, verifyPassword
- `@repo/auth/lib/cookies` — setSessionCookie, clearSessionCookie, getSessionCookie
- `@repo/auth/lib/tokens` — generateEmailToken, verifyEmailToken
- `@repo/auth/lib/env` — getJwtSecret, getJwtTtlSeconds, getBcryptRounds, getMongoDbUri
- `@repo/auth/hooks/useAuth` — configurable hook (accepts basePath option)
- `@repo/auth/components/AuthCard` — layout wrapper
- `@repo/auth/components/LoginForm` — render-prop pattern (configurable redirectTo, basePath)
- `@repo/auth/components/SignupForm` — render-prop pattern
- `@repo/auth/components/LogoutButton` — render-prop pattern

### @repo/ui (`packages/ui/`)

Shared React UI components.

**Exports:**

- `@repo/ui/form-button` — FormButton (with loading state)
- `@repo/ui/input` — Input (with label)
- `@repo/ui/password-input` — PasswordInput (with show/hide toggle)
- `@repo/ui/form-error` — FormError (error message display)
- `@repo/ui/button` — Button (original Turborepo demo)
- `@repo/ui/card` — Card (original Turborepo demo)
- `@repo/ui/code` — Code (original Turborepo demo)

## Environment Variables

### Auth Service (`monorepo/apps/auth-service/.env.local`)

```
JWT_SECRET=
JWT_EXPIRES_IN_SECONDS=3600
BCRYPT_SALT_ROUNDS=10
MONGODB_URI=
RESEND_API_KEY=
EMAIL_FROM=noreply@yourdomain.com
NEXT_PUBLIC_APP_URL=http://localhost:3002
```

### Chatbot Service (`microservices/chatbot-service/.env`)

```
EMBED_PROVIDER=ollama
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_MODEL=qwen2.5:14b
OLLAMA_TIMEOUT_SECONDS=300
RAG_TEST_MODE=0
```

### Frontend Web App (`monorepo/apps/web/.env.local`)

```
SCRAPER_API_URL=http://localhost:8000          # Web scraper service
CHATBOT_API_URL=http://localhost:8000          # NEW — Chatbot service (for vector DB ingestion)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Web Scraper (`monorepo/apps/webscraper/.env`)

```
SCRAPER_API_KEY=
SCRAPER_ALLOWED_DOMAINS=[]
SCRAPER_REQUEST_TIMEOUT_SECONDS=30
SCRAPER_PLAYWRIGHT_TIMEOUT_MS=30000
SCRAPER_MAX_CONCURRENT_REQUESTS=10
SCRAPER_MAX_RETRIES=3
SCRAPER_RATE_LIMIT_PER_MINUTE=60
```

## Service Ports

| Service                | Port | URL                   |
| ---------------------- | ---- | --------------------- |
| Auth Service           | 3002 | http://localhost:3002 |
| Web App (monorepo)     | 3000 | http://localhost:3000 |
| Docs App (monorepo)    | 3001 | http://localhost:3001 |
| Chatbot API            | 8000 | http://localhost:8000 |
| Inngest Dev            | 8288 | http://localhost:8288 |
| Streamlit UI           | 8501 | http://localhost:8501 |
| Web Scraper (monorepo) | 8000 | http://localhost:8000 |

> Chatbot API and Web Scraper both default to port 8000 — run on different ports if using simultaneously.

## Git Branches

- `main` — stable base
- `feature/multi-service-structure` — microservices setup
- `feature/shared-auth-package` — shared @repo/auth and @repo/ui packages extracted (auth-service app not yet moved to monorepo)

## Known Issues

- **Turbo CLI broken:** There is a stale `node_modules` folder at `C:\Users\My Computer\node_modules\` that hijacks npm resolution. Delete it to fix `turbo run` commands. Workaround: run `npx next dev` directly from the app directory.
- **Port conflict:** Chatbot API and Web Scraper both use 8000 by default.

## Code Changes — Scraper → Vector DB Integration

### `microservices/chatbot-service/main.py`

1. **Import `SentenceSplitter`** (line 16)
   - From llama_index — chunks text like PDFs (1000 chars, 200 overlap)

2. **Initialize splitter** (line 23)

   ```python
   splitter = SentenceSplitter(chunk_size=1000, chunk_overlap=200) if not IS_TEST_MODE else None
   ```

3. **New Inngest function: `rag_ingest_text_content`** (lines 75-130)
   - Event trigger: `rag/ingest_text_content`
   - Chunks text → embeds → upserts to Chroma
   - Rate limit: 10/hour per source

4. **New HTTP endpoint: `POST /api/v1/ingest-text`** (lines 227-268)
   - Accepts: `{ text_content, source_id, title?, url? }`
   - Sends async Inngest event
   - Returns `{ success, message, source_id }`

5. **New HTTP endpoint: `POST /api/v1/query`** (lines 271-302)
   - Accepts: `{ question, top_k? }`
   - Searches vector DB synchronously
   - Returns `{ success, contexts, sources, num_results }`

6. **Updated Inngest serve** (line 213)
   - Registers new `rag_ingest_text_content` function

### `microservices/chatbot-service/custom_types.py`

- **New class: `RAGIngestTextRequest`** (lines 26-30)
  ```python
  class RAGIngestTextRequest(pydantic.BaseModel):
      text_content: str
      source_id: str
      title: str | None = None
      url: str | None = None
  ```

### `monorepo/apps/web/app/api/scraper/scrape/route.ts`

- **New function: `sendToChatbotService()`** (lines 5-25)
  - Sends scraped data to chatbot service
  - Fire-and-forget (doesn't block response)

- **Modified POST handler** (lines 27-48)
  - Calls scraper → gets data
  - If successful, sends to chatbot service asynchronously
  - Returns scraper result to frontend

### `monorepo/apps/web/app/api/scraper/crawl/route.ts`

- **New function: `sendToChatbotService()`** (same as scrape)

- **Modified POST handler** (lines 27-52)
  - Crawls site → gets array of pages
  - For each page, sends to chatbot service separately
  - Each page gets unique source_id: `{baseUrl}#page-{index}`

## Known Issues

## How to Run

### Auth Service (from microservices)

```bash
cd microservices/auth-service
cp .env.example .env.local   # fill in values
npx next dev --port 3002
```

### Chatbot Service

```bash
cd microservices/chatbot-service
# Start Ollama, then:
.\scripts\run-api.bat         # Terminal 1
.\scripts\run-inngest.bat     # Terminal 2
.\.venv\Scripts\python.exe -m streamlit run streamlit_app.py --server.port 8501  # Terminal 3
```

### Web Scraper (from monorepo)

```bash
cd monorepo/apps/webscraper
npm run setup                       # first time only — creates .venv, installs deps + Playwright
# Then either:
turbo run dev --filter=webscraper   # from monorepo root
# or:
npm run dev                         # from apps/webscraper directly
```
