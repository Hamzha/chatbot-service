# Project Context — AI Chatbot Platform

## Overview

This is an AI-powered chatbot platform with authentication, web scraping, and RAG-based PDF Q&A capabilities. The codebase is structured as a monorepo + microservices hybrid.

## Current State (April 2026)

### Web routing toggle (widget + dashboard)

- The web app now supports a backend switch via `USE_CHATBOT_API` (or `NEXT_PUBLIC_USE_CHATBOT_API`).
- `USE_CHATBOT_API=true` routes chatbot calls to chatbot-api.
- `USE_CHATBOT_API=false` routes chatbot calls to model-gateway-api.
- Current exception: ingest remains on chatbot-api. `POST /api/chatbot/ingest` still proxies to chatbot-api `/v1/ingest` (Inngest flow not migrated yet).
- This toggle is implemented for both:
  - public widget chat route
  - dashboard chat query flow

### Dashboard contract compatibility

- Dashboard UI expects async query contract: `POST /api/chatbot/query` returns `event_ids`, then UI polls `GET /api/chatbot/jobs/{eventId}`.
- model-gateway chat is synchronous, so web app now creates synthetic job IDs for model-gateway responses and resolves them through `/api/chatbot/jobs/{eventId}`.
- This keeps dashboard frontend behavior unchanged while allowing backend switching.

### Shared vector storage

- chatbot-api and model-gateway-api are configured to use the same persistent Chroma directory and collection.
- Result: both services read/write the same knowledge base embeddings.

### model-gateway embedding model note

- model-gateway uses `OPEN_ROUTER_EMBED_MODEL` for embeddings.
- Chat generation model is `DEFAULT_MODEL` (currently free-tier model by default).
- If embedding errors mention missing/paid model, verify the exact model slug exists for the current OpenRouter key.
- Current requested embedding model for model-gateway env: NVIDIA Llama Nemotron Embed VL 1B V2 (free), via `OPEN_ROUTER_EMBED_MODEL`.

### OpenRouter API key setup (model-gateway-api)

- `OPEN_ROUTER_API_KEY` is required for model-gateway chat + embedding calls.
- Create/get key from OpenRouter dashboard:
  - Sign in at [https://openrouter.ai](https://openrouter.ai)
  - Open **Keys** page: [https://openrouter.ai/keys](https://openrouter.ai/keys)
  - Create a new key and copy it.
- Add it to `monorepo/apps/model-gateway-api/.env`:
  - `OPEN_ROUTER_API_KEY=sk-or-v1-...`
- Keep it only in local/private env files. Do not commit real keys.

### Chroma path mismatch bug we hit

- Symptom we observed:
  - same `source_id` returned contexts in one backend, but `num_contexts: 0` in the other.
- Root cause:
  - `chatbot-api` and `model-gateway-api` were pointing to different `CHROMA_PERSIST_DIR` values.
- Required fix:
  - set both services to the same shared directory, for example `../../chroma_data` in each app env.
  - keep `CHROMA_COLLECTION` aligned as well (currently `chatbot_chunks`).
- Why this matters:
  - if paths differ, each service reads a different vector store and retrieval results diverge.

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

## Current Chatbot Data Model

- The per-user chatbot record now lives in `monorepo/apps/web/lib/db/chatSessionRepo.ts`.
- Each chatbot/session record stores `userId`, `name`, `primaryColor`, and `selectedRagKeys`.
- `primaryColor` is stored on the chatbot/session record itself, not in `widgetConfigRepo.ts`.
- A single user can have multiple chatbot/session records, and each one can have its own color.
- The dashboard pages for customize/get-script should load the chatbot/session list and edit the selected record.

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

## Embeddable Chatbot Widget

The platform provides an embeddable chatbot widget that users can add to any external website via a script tag.

### Widget Script — `monorepo/apps/web/public/chatbot-widget.js`

- Self-contained IIFE — injects a floating chat bubble + panel into the host page
- Reads `data-bot-id` from the script tag (botId = userId)
- Derives `apiBase` from the script's own `src` URL so API calls work from external sites
- On load: fetches the user's saved color config **before** rendering (no flicker)
- Sends user messages to the chat API and displays bot replies
- Fully dynamic colors: launcher, header, send button, user bubbles, focus rings, shadows — all derived from one primary color
- Mobile responsive, typing indicator, error handling, input disable during send

### Widget API Routes (public, no auth — but validate botId exists)

**`POST /api/chatbot/widget/chat`** — `app/api/chatbot/widget/chat/route.ts`

- Accepts: `{ botId, message }`
- Validates request via `lib/chatbot/validateWidgetRequest.ts` (separate function for easy editing)
  - Checks botId is a valid user ID (calls `findUserById`)
  - Checks message is non-empty, max 500 chars
- Returns: `{ reply }` — currently static, will be wired to chatbot service

**`GET /api/chatbot/widget/config/[botId]`** — `app/api/chatbot/widget/config/[botId]/route.ts`

- Public endpoint called by the widget script on load
- Validates botId exists in database
- Returns: `{ primaryColor }` (or default `#0f766e`)

### Widget Config API (auth-protected — dashboard use)

**`GET /api/chatbot/widget/config`** — Returns the logged-in user's saved widget color

**`PUT /api/chatbot/widget/config`** — `app/api/chatbot/widget/config/route.ts`

- Accepts: `{ primaryColor }` (must be valid hex like `#0f766e`)
- Upserts to MongoDB `WidgetConfig` collection (one config per user)

### Widget Config MongoDB Schema — `lib/db/widgetConfigRepo.ts`

- **Model:** `WidgetConfig`
- **Fields:** `userId` (ObjectId, unique, indexed), `primaryColor` (string, default `#0f766e`), timestamps
- **Functions:** `getWidgetConfig(userId)`, `upsertWidgetConfig(userId, primaryColor)`

### Customize Page — `app/(protected)/dashboard/customize/page.tsx`

- Dashboard page at `/dashboard/customize`
- Native color picker (large) + hex input for any color
- Auto-generated shade row from the selected color
- Live preview of the widget (header, messages, send button, launcher) — updates in real time
- Save button styled with the selected color, reset button for unsaved changes
- Fetches saved color on load, saves via `PUT /api/chatbot/widget/config`

### Get Script Page — `app/(protected)/dashboard/get-script/page.tsx`

- Dashboard page at `/dashboard/get-script`
- Fetches user's botId from `GET /api/chatbot/bot-id` (botId = userId)
- Generates embed snippet: `<script src="{origin}/chatbot-widget.js" data-bot-id="{botId}"></script>`
- Copy to clipboard button

### Validation — `lib/chatbot/validateWidgetRequest.ts`

- Separate validation function for widget chat requests
- Checks: botId exists (via `findUserById`), message non-empty, message max 500 chars
- Returns typed `ValidationResult` (success with cleaned data, or failure with error + status)
- Designed to be easily extended with origin checking, rate limiting, etc.

## Next Step: Iframe-Based Widget Architecture (Planned)

The current widget script builds the full UI on the client's site and makes API calls directly from their domain. The senior-recommended approach is to switch to an **iframe-based architecture** — this is how production embed widgets (Intercom, Crisp, Tidio, etc.) work.

### Current approach (direct script)

```
Client's website
  → loads chatbot-widget.js from our server
  → script builds the entire chatbot UI (DOM, CSS) on THEIR page
  → script makes fetch() calls directly to our API from THEIR domain
  → needs CORS headers, API endpoints exposed in devtools
```

### Planned approach (iframe)

```
Client's website
  → loads chatbot-widget.js from our server
  → script ONLY injects a launcher button + an <iframe>
  → iframe src = "ourdomain.com/widget/[botId]"
  → iframe loads a full chatbot page hosted on OUR domain
  → all API calls happen inside the iframe (same-origin, no CORS)
  → client's site never sees our API endpoints
```

### Why iframe is better

- **No CORS** — iframe is our domain talking to our domain, no cross-origin issues
- **Security** — API endpoints not exposed to the client's site or devtools
- **Easy updates** — update the widget page on our server, every client gets it instantly without changing their script tag
- **Isolation** — client's page JS cannot tamper with or read the widget content
- **Styling safety** — client's CSS cannot accidentally break the widget UI
- **Same script tag** — the embed snippet `<script src="..." data-bot-id="...">` stays the same, only the script internals change

### What needs to be built

1. **Widget page route** — e.g. `app/widget/[botId]/page.tsx` — a standalone Next.js page that renders the full chatbot UI (header, messages, input). This page uses the botId from the URL to fetch config (color) and handle chat API calls. No dashboard layout/sidebar, just the chatbot.

2. **Updated `chatbot-widget.js`** — becomes a thin loader:
   - Injects a launcher button (floating circle)
   - On click: creates/shows an `<iframe src="ourdomain.com/widget/[botId]">` styled as the chat panel
   - Communicates with iframe via `postMessage` if needed (e.g. to close the panel)
   - The launcher button color could be passed as a query param or fetched via config API

3. **postMessage communication** (optional) — for the iframe to tell the parent script to close the panel, show notifications, etc.

### Research topics

- `window.postMessage` for iframe ↔ parent communication
- How Intercom/Crisp embed scripts work (inspect their script tags)
- Next.js route groups for the widget page (no layout inheritance)
- Content Security Policy (CSP) `frame-ancestors` to control which domains can embed the iframe
- `sandbox` attribute on iframe for extra security

## Page-Level RBAC Gating

Dashboard pages are now gated server-side so direct URL access by a user without the required permission redirects to `/dashboard` instead of rendering. Previously only the sidebar hid the links and the underlying API returned 403.

### Helper — `lib/auth/requirePagePermission.ts`

```ts
await requirePagePermission("scraper:read");
// redirects to /login if unauth'd
// redirects to /dashboard if missing permission
// returns { user, ctx } otherwise
```

### Pattern for client-only pages

Each client `page.tsx` was split into two files:

- `SomethingClient.tsx` — kept the `"use client"` directive and all the original logic; exports a named component `SomethingClient`.
- `page.tsx` — thin async server component that calls `requirePagePermission(...)` then renders `<SomethingClient />`.

### Gated routes

| Route                                 | Permission                   |
| ------------------------------------- | ---------------------------- |
| `/dashboard`                          | `dashboard:read`             |
| `/dashboard/scraper`                  | `scraper:read`               |
| `/dashboard/upload-document`          | `chatbot_documents:create`   |
| `/dashboard/chatbot`                  | `chatbot_sessions:read`      |
| `/dashboard/chatbot/new`              | `chatbot_sessions:create`    |
| `/dashboard/chatbot/[sessionId]`      | `chatbot_sessions:read`      |
| `/dashboard/get-script`               | `chatbot_sessions:read`      |
| `/dashboard/customize`                | `chatbot_sessions:update`    |
| `/dashboard/admin/roles`              | `roles:read`                 |
| `/dashboard/admin/users`              | `users:read`                 |

`/dashboard/profile` is intentionally ungated — any logged-in user should see their own profile.

The existing sidebar visibility logic (`components/dashboard/Sidebar.tsx` + `lib/dashboard/dashboardSidebarNav.ts`) is unchanged and still hides nav links based on the same permissions.

## API Rate Limiting

Server-side, Mongo-backed rate limiting applied at the top of each protected route handler. Fixed-window counters, one collection document per (bucket, key, time-window) with a TTL index for auto-cleanup. No Redis or external dependency.

### Files

- `lib/rateLimit/rateLimitRepo.ts` — Mongoose `RateLimit` model (`_id` = `${bucket}:${key}:${windowIndex}`, TTL index on `expiresAt`) + `consumeRateLimit(bucket, key, limit, windowSec)`.
- `lib/rateLimit/requireRateLimit.ts` — two helpers:
  - `requireRateLimitByIp(request, bucket, { limit, windowSec })` — reads `x-forwarded-for` / `x-real-ip`; falls back to `"unknown"`.
  - `requireRateLimitByUser(userId, bucket, { limit, windowSec })` — for authenticated routes.
  - Both return `NextResponse` **429** with `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers, or `null` to continue.

### Environment flags

- **Default:** disabled in dev, enabled in production (`NODE_ENV === "production"`).
- `RATE_LIMIT_ENABLED=true` — force-enable in dev.
- `RATE_LIMIT_DISABLED=true` — force-disable even in production.

### Limits applied

**Unauthenticated (per-IP):**

| Route                                | Limit        |
| ------------------------------------ | ------------ |
| `POST /api/auth/login`               | 5 / 15 min   |
| `POST /api/auth/signup`              | 5 / 1 hr     |
| `POST /api/auth/forgot-password`     | 3 / 15 min   |
| `POST /api/auth/reset-password`      | 5 / 15 min   |
| `GET  /api/auth/verify-email`        | 10 / 15 min  |
| `POST /api/auth/demo-login`          | 5 / 15 min   |
| `POST /api/chatbot/widget/chat`      | 30 / 1 min   |

**Authenticated expensive ops (per-user):**

| Route                                | Limit      |
| ------------------------------------ | ---------- |
| `POST /api/scraper/scrape`           | 20 / 1 min |
| `POST /api/scraper/crawl/jobs`       | 5 / 1 min  |
| `POST /api/chatbot/query`            | 30 / 1 min |
| `POST /api/chatbot/ingest`           | 10 / 1 min |

Cheap/read-only routes (`/api/auth/me`, `/api/auth/logout`, `/api/chatbot/{sessions,messages,documents,jobs,sources,bot-id}`, `/api/admin/*`, `/api/chatbot/widget/config`) are left ungated for now.

## Known Issues

## How to Run

### Auth Service (from microservices)

```bash
cd microservices/auth-service
cp .env.example .env.local   # fill in values
npx next dev --port 3002
```

### Chatbot API (current, monorepo)

```bash
cd monorepo/apps/chatbot-api
# first time only
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e .

# set envs in .env / .env.local (important)
# CHROMA_PERSIST_DIR should match model-gateway-api CHROMA_PERSIST_DIR

# run API (port 8001 by default)
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

### Inngest Dev Server (for chatbot-api query/ingest jobs)

```bash
cd monorepo
npm run dev:chatbot-inngest
```

### Model Gateway API (current, monorepo)

```bash
cd monorepo/apps/model-gateway-api
# first time only
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e .

# set envs in .env
# CHROMA_PERSIST_DIR should match chatbot-api CHROMA_PERSIST_DIR

# run API (port 8003 by default)
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8003
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
