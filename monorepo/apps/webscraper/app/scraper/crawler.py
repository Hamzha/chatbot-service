import asyncio
import logging
from typing import AsyncGenerator
from urllib.parse import urlparse, urljoin
from app.api.schemas import ScrapeMode
from app.scraper.factory import scrape

logger = logging.getLogger(__name__)


def is_same_domain(base_url: str, target_url: str) -> bool:
    """Check if target URL belongs to the same domain as base URL."""
    base_host = urlparse(base_url).hostname
    target_host = urlparse(target_url).hostname
    return base_host == target_host


def normalize_url(url: str) -> str:
    """Normalize URL to avoid duplicates (remove fragments, trailing slashes)."""
    parsed = urlparse(url)
    # Remove fragment (#section), normalize path
    path = parsed.path.rstrip("/") or "/"
    return f"{parsed.scheme}://{parsed.netloc}{path}"


def should_skip_url(url: str) -> bool:
    """Skip non-HTML resources like images, PDFs, etc."""
    skip_extensions = (
        ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".ico",
        ".pdf", ".doc", ".docx", ".xls", ".xlsx",
        ".zip", ".rar", ".tar", ".gz",
        ".mp3", ".mp4", ".avi", ".mov",
        ".css", ".js", ".json", ".xml",
        ".woff", ".woff2", ".ttf", ".eot",
    )
    path = urlparse(url).path.lower()
    return path.endswith(skip_extensions)


async def crawl_website_stream(
    start_url: str,
    mode: ScrapeMode = ScrapeMode.AUTO,
    max_pages: int = 50,
    max_depth: int = 3,
) -> AsyncGenerator[dict, None]:
    """
    Streaming BFS crawl. Yields event dicts as the crawl progresses:

      - {"type": "start", "start_url", "max_pages", "max_depth"}
      - {"type": "visiting", "url", "depth", "index", "max_pages"}
      - {"type": "page", "url", "depth", "index", "data": <ScrapedData JSON>}
      - {"type": "failed", "url", "error"}
      - {"type": "done", "total_pages", "failed_count"}

    Redirect handling: if the start URL redirects to a different host (e.g.
    an entire site rebrand), the crawler adopts the redirected host as the
    same-domain anchor and resolves all relative links against the page's
    FINAL url, not the URL we originally requested. This avoids a cascade
    of spurious 404s on the dead host.
    """
    visited: set[str] = set()
    pages_count = 0
    failed_count = 0

    queue: asyncio.Queue[tuple[str, int]] = asyncio.Queue()
    start_norm = normalize_url(start_url)
    await queue.put((start_norm, 0))
    visited.add(start_norm)

    # Host used by the same-domain filter. Overwritten by the first successful
    # page's FINAL URL if it redirected to a different host.
    effective_host_url = start_url

    yield {
        "type": "start",
        "start_url": start_url,
        "max_pages": max_pages,
        "max_depth": max_depth,
    }

    while not queue.empty() and pages_count < max_pages:
        url, depth = await queue.get()

        yield {
            "type": "visiting",
            "url": url,
            "depth": depth,
            "index": pages_count + 1,
            "max_pages": max_pages,
        }

        try:
            data = await scrape(url=url, mode=mode)
            pages_count += 1

            # `data.url` is the FINAL URL after any redirects. Use it as the
            # base for link resolution and — for the very first page — as the
            # new same-domain anchor.
            effective_url = data.url or url
            effective_norm = normalize_url(effective_url)
            # Mark the post-redirect URL as visited too so a self-link
            # (e.g. `<a href="/">Home</a>`) on the landing page doesn't cause
            # us to re-scrape the same page under a different URL.
            visited.add(effective_norm)
            if depth == 0 and not is_same_domain(effective_host_url, effective_url):
                logger.info(
                    f"Start URL redirected: {start_url} → {effective_url}; "
                    f"adopting new host for same-domain filter."
                )
                effective_host_url = effective_url

            yield {
                "type": "page",
                "url": effective_norm,
                "depth": depth,
                "index": pages_count,
                "data": data.model_dump(mode="json"),
            }

            if depth >= max_depth:
                continue

            for link in data.links:
                href = link.get("href", "")
                if not href:
                    continue

                full_url = urljoin(effective_url, href)
                normalized = normalize_url(full_url)

                if (
                    normalized not in visited
                    and is_same_domain(effective_host_url, full_url)
                    and not should_skip_url(full_url)
                    and len(visited) < max_pages
                ):
                    visited.add(normalized)
                    await queue.put((normalized, depth + 1))

        except Exception as e:
            failed_count += 1
            logger.error(f"Failed to scrape {url}: {e}")
            yield {"type": "failed", "url": url, "error": str(e)}

    yield {
        "type": "done",
        "total_pages": pages_count,
        "failed_count": failed_count,
    }
