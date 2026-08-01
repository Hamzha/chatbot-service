# Website Embed Chatbot Plan (Script Tag Model)

## Objective

Enable each business owner to:

1. Scrape their website content from the platform
2. Ingest that content into their own chatbot knowledge base
3. Copy one script tag
4. Paste it into their website HTML
5. Instantly show a branded chatbot widget to visitors

## Product Outcome

- Fast onboarding for non-technical business owners
- Reusable embeddable chatbot across any website CMS/framework
- Multi-tenant isolation so each business sees only its own data
- Clear upgrade path to WhatsApp, voice, and omnichannel automation

## Current Baseline (Already Available)

- Web scraping flow exists
- Scraped text can be sent to chatbot ingestion endpoint
- Async ingestion and vector storage pipeline exists
- Query endpoint exists for retrieval

This plan adds the productization layer: tenant-safe bot configuration + embeddable website widget.

## Target User Flow

1. Business owner signs up and creates a bot
2. Owner enters website URL and runs scrape/crawl
3. Platform ingests scraped pages into vector DB under that bot
4. Owner sees ingestion progress and completion status
5. Owner copies generated script tag from dashboard
6. Owner pastes script into website
7. Website visitors can chat with AI bot trained on that business data

## System Design

### 1) Multi-Tenant Bot Layer

Create bot-level entities:

- bot_id
- owner_user_id
- public_key (for widget)
- allowed_domains (origin allowlist)
- model settings (temperature, top_k, prompt profile)
- branding settings (primary color, logo, greeting)
- status (draft, active, paused)

Create source-level entities:

- source_id
- bot_id
- source_type (scrape, pdf, manual)
- source_url
- ingest_status (queued, processing, completed, failed)
- chunk_count
- created_at

### 2) Embedding Metadata Strategy

During ingest, attach metadata:

- bot_id
- source_id
- url
- title
- chunk_index

During query, filter retrieval by bot_id to enforce strict tenant isolation.

### 3) Widget Delivery Architecture

Use iframe-based embed first (recommended for v1):

- Loader script injected via script tag
- Script creates floating launcher button
- On click, opens iframe panel from platform domain
- Iframe hosts full chat UI and calls chatbot API

Why iframe first:

- Strong CSS/JS isolation from customer site
- Safer security boundary
- Easier upgrades without breaking host websites

### 4) API Surface

#### Ingestion APIs

- POST /api/v1/bots/:botId/scrape
- POST /api/v1/bots/:botId/crawl
- GET /api/v1/bots/:botId/sources
- GET /api/v1/bots/:botId/sources/:sourceId/status

#### Widget APIs

- POST /api/v1/widget/session
  - validates bot_id + origin + public key
  - returns short-lived widget token

- POST /api/v1/widget/chat
  - input: bot_id, session_id, visitor_message
  - retrieval scoped by bot_id
  - returns answer + optional citations

#### Admin APIs

- GET /api/v1/bots/:botId/embed-script
- PATCH /api/v1/bots/:botId/branding
- PATCH /api/v1/bots/:botId/security

### 5) Security Model

Required controls:

- Origin/domain allowlist per bot
- Public widget key (client-visible), secret key only server-side
- Signed short-lived widget token from session endpoint
- Rate limiting by bot_id + IP + session_id
- Message length/token guardrails
- CORS restricted to configured domains
- Basic abuse filtering and anomaly monitoring

## Script Tag Specification

Base embed format:

<script
  src="https://your-platform.com/widget.js"
  data-bot-id="bot_123"
  data-public-key="pk_live_abc"
  data-position="right"
  data-theme-color="#0EA5E9"
></script>

Loader responsibilities:

1. Read data attributes
2. Validate required fields
3. Create launcher button
4. Open iframe panel to platform embed route
5. Pass config to iframe securely

## Frontend Experience (Business Owner Dashboard)

### Setup Wizard

Step 1: Bot basics

- Bot name
- Industry
- Language

Step 2: Website training

- Input URL
- Choose scrape single page or crawl domain
- Show live ingest progress

Step 3: Branding

- Chat title
- Welcome message
- Brand color
- Avatar/logo

Step 4: Install

- Copy script tag
- Platform-specific quick guides (WordPress, Shopify, custom HTML)
- Verify installation test

### Monitoring Panel

- Total chats
- Top user questions
- Unanswered/low-confidence questions
- Source coverage and stale pages
- Widget health and blocked-origin events

## Execution Plan (Phased)

## Phase 1: Data and Tenant Foundations (Week 1)

Deliverables:

- Bot configuration schema
- Source tracking schema
- bot_id metadata in ingest pipeline
- Query filtering by bot_id

Success criteria:

- No cross-tenant retrieval leakage in tests
- All chunks are traceable to bot and source

## Phase 2: Widget Backend + Security (Week 2)

Deliverables:

- widget/session endpoint
- widget/chat endpoint
- origin allowlist enforcement
- rate limiting and token validation

Success criteria:

- Chat blocked on invalid origin/key
- Stable p95 response time under target load

## Phase 3: Embeddable Loader + Iframe UI (Week 3)

Deliverables:

- public widget.js loader
- iframe chat route
- floating launcher and open/close behavior
- mobile-responsive chat panel

Success criteria:

- Installation works on static HTML and common CMS pages
- UI unaffected by host website CSS

## Phase 4: Dashboard UX + Copy/Paste Install (Week 4)

Deliverables:

- setup wizard
- scrape/crawl trigger UI
- status and logs UI
- script generation and copy button

Success criteria:

- New customer completes setup in under 10 minutes
- High first-time successful installation rate

## Phase 5: Reliability and GTM Readiness (Week 5)

Deliverables:

- observability (logs, metrics, alerts)
- retry handling and dead-letter strategy
- onboarding docs and support playbooks
- billing hooks for package limits

Success criteria:

- low ingestion failure rate
- support can diagnose installation issues quickly

## Testing Strategy

### Functional

- scrape to ingest end-to-end
- embed installation and first chat
- bot-scoped retrieval validation

### Security

- origin spoof attempts
- invalid/expired token checks
- rate limit bypass attempts

### Compatibility

- Chrome, Safari, Firefox, Edge
- mobile viewport behavior
- install test on popular CMS templates

## Operational Metrics

Track:

- Time to first successful response after setup
- Ingestion completion time per source
- Chat answer latency (p50/p95)
- Retrieval hit rate
- Widget load success rate
- Blocked request count (security)

## Risks and Mitigations

1. Port conflicts between services

- Mitigation: assign dedicated ports and centralized environment config

2. Cross-tenant data leakage

- Mitigation: mandatory bot_id filtering + integration tests + audit logs

3. Scraper variability across modern JS-heavy sites

- Mitigation: fallback strategies, retries, and crawl diagnostics

4. Host website conflicts

- Mitigation: iframe isolation and minimal loader surface

5. Abuse and spam usage

- Mitigation: per-bot quotas, throttling, and automated abuse rules

## Packaging Alignment

Starter package:

- one bot, limited pages, basic widget

Growth package:

- more pages, advanced branding, analytics

Pro package:

- multi-bot, API access, higher limits, priority support

## Definition of Done

The feature is complete when:

1. A business owner can scrape website content from dashboard
2. Content is ingested and queryable under correct bot_id
3. Owner can copy script tag and install chatbot on website
4. Visitor chat works with secure tenant isolation
5. Team can monitor usage, errors, and security events in production
