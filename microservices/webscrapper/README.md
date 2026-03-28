# Web Scraper Microservice — Context

## Overview
A FastAPI-based web scraping microservice that accepts a URL and returns structured JSON data. Supports both static (HTML) and dynamic (JavaScript-rendered) websites.

## Tech Stack
- **Framework:** FastAPI + Uvicorn
- **Static Scraping:** httpx + BeautifulSoup4 + lxml
- **Dynamic Scraping:** Playwright (sync API running in a thread — fixes Windows event loop issue)
- **Config:** pydantic-settings (loads from `.env` with `SCRAPER_` prefix)
- **Python:** 3.13

## API Endpoints

### `GET /health`
Health check. Returns `{"status": "ok"}`.

### `POST /api/v1/scrape`
Scrape a single page.
```json
{
  "url": "https://example.com",
  "mode": "auto",              // "auto" | "static" | "dynamic"
  "wait_for_selector": null    // optional CSS selector for dynamic mode
}
```

### `POST /api/v1/crawl`
Crawl an entire website (follows internal links).
```json
{
  "url": "https://example.com",
  "mode": "auto",
  "max_pages": 50,    // max total pages (1-200)
  "max_depth": 3      // max link depth (1-10)
}
```

## Response Structure
Each scraped page returns:
- `title` — page title
- `meta_description` — meta description tag
- `headings` — h1-h6 grouped by level
- `links` — all links with text and href
- `images` — all images with alt and src
- `text_content` — all visible text (scripts/styles/nav/footer removed)
- `tables` — structured table data
- `mode_used` — "static" or "dynamic"

## Folder Structure
```
webscrapper/
├── app/
│   ├── main.py              # FastAPI app + middleware setup
│   ├── config.py            # Settings from env vars (SCRAPER_ prefix)
│   ├── api/
│   │   ├── router.py        # /scrape and /crawl endpoints
│   │   ├── schemas.py       # Pydantic request/response models
│   │   └── middleware.py     # API key auth + rate limiting
│   ├── scraper/
│   │   ├── factory.py       # Auto-detects and routes to right scraper
│   │   ├── static_scraper.py  # httpx fetch
│   │   ├── dynamic_scraper.py # Playwright (sync in thread)
│   │   ├── detector.py      # Static vs dynamic detection heuristics
│   │   ├── parser.py        # HTML → structured JSON
│   │   └── crawler.py       # Recursive website crawler
│   └── anti_block/
│       ├── headers.py       # Rotating user agents + realistic headers
│       └── retry.py         # Exponential backoff retry
├── Dockerfile
├── requirements.txt
└── .env.example
```

## Key Design Decisions

1. **Auto-detection:** In "auto" mode, fetches with httpx first. If body is mostly empty with SPA markers (React/Vue/Next.js), switches to Playwright.

2. **Playwright sync in thread:** Playwright's async API has a `NotImplementedError` on Windows due to event loop conflicts with uvicorn. Fixed by using sync Playwright API via `run_in_executor()`.

3. **Crawler logic:** BFS traversal. Normalizes URLs (removes fragments, trailing slashes). Skips non-HTML files (images, PDFs, CSS, JS). Only follows same-domain links.

4. **Security:** SSRF prevention (blocks localhost, private IPs, non-HTTP schemes). API key auth via `X-API-Key` header. Rate limiting per IP. Optional domain allowlist.

5. **No Redis/queue:** Kept simple — synchronous request/response. No external dependencies beyond Playwright's Chromium.

## Running Locally
```bash
# Activate venv
source venv/Scripts/activate

# Start server
uvicorn app.main:app --reload
```

## Environment Variables
```
SCRAPER_API_KEY=           # empty = auth disabled
SCRAPER_ALLOWED_DOMAINS=[] # empty = all domains allowed
SCRAPER_REQUEST_TIMEOUT_SECONDS=30
SCRAPER_PLAYWRIGHT_TIMEOUT_MS=30000
SCRAPER_MAX_CONCURRENT_REQUESTS=10
SCRAPER_MAX_RETRIES=3
SCRAPER_RATE_LIMIT_PER_MINUTE=60
```

## Communicating from Node.js Backend
```javascript
const response = await fetch("http://localhost:8000/api/v1/crawl", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "your-api-key"   // if auth is enabled
  },
  body: JSON.stringify({
    url: "https://example.com",
    mode: "auto",
    max_pages: 20,
    max_depth: 2
  })
});
const data = await response.json();
```

## Server runs on
- **Local:** http://localhost:8000
- **Docs:** http://localhost:8000/docs (Swagger UI auto-generated)
