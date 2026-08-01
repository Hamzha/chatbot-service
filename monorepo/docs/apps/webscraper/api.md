# webscraper API

Base prefix is `/api/v1`.

## Health

- `GET /health` - lightweight health check (`{"status":"ok"}`).

## Scrape

- `POST /api/v1/scrape`
  - Request fields:
    - `url` (required)
    - `mode` (`auto` | `static` | `dynamic`)
    - `wait_for_selector` (optional, dynamic mode helper)
  - Returns structured content payload:
    - title
    - meta_description
    - headings
    - links
    - images
    - text_content
    - tables
    - mode_used

## Crawl

- `POST /api/v1/crawl/stream`
  - Request fields:
    - `url`
    - `mode`
    - `max_pages` (1-200)
    - `max_depth` (1-10)
  - Response type: `application/x-ndjson`
  - Emits line-delimited JSON events for progress and errors.

## Error Patterns

- `403` when domain is outside configured allowlist.
- `4xx` request validation issues.
- Streaming crawl may emit an `{"type":"error"}` event on runtime exceptions.
