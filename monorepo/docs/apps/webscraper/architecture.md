# webscraper Architecture

## Core Modules

- `app/main.py` - FastAPI app setup and middleware registration.
- `app/api/router.py` - `/scrape` and `/crawl/stream` endpoints.
- `app/api/middleware.py` - API key and rate limiting middleware.
- `app/scraper/factory.py` - mode selection and execution orchestration.
- `app/scraper/static_scraper.py` - httpx-based fetch.
- `app/scraper/dynamic_scraper.py` - Playwright-based fetch.
- `app/scraper/crawler.py` - link traversal and streaming crawl events.
- `app/scraper/parser.py` - HTML to structured output.

## Scrape Flow

```mermaid
sequenceDiagram
    participant Web as web
    participant API as webscraper /api/v1/scrape
    participant Factory
    participant Static as static scraper
    participant Dynamic as playwright scraper
    participant Parser

    Web->>API: url + mode
    API->>Factory: scrape(url, mode)
    alt mode=static
        Factory->>Static: fetch HTML
    else mode=dynamic
        Factory->>Dynamic: render + extract HTML
    else mode=auto
        Factory->>Static: detect first
        Factory->>Dynamic: fallback for JS-heavy pages
    end
    Factory->>Parser: structured extraction
    API-->>Web: title/headings/links/images/text/tables
```

## Crawl Stream Flow

```mermaid
flowchart LR
    A[POST /api/v1/crawl/stream] --> B[Validate + domain check]
    B --> C[Crawler BFS over internal links]
    C --> D[Yield NDJSON progress events]
    D --> E[Client consumes stream]
```

## Key Design Notes

- Domain allowlist and SSRF protections are enforced before scrape/crawl execution.
- Crawl endpoint streams incremental events to support long-running job monitoring.
- Middleware-driven rate limiting and API key support protect service capacity.
