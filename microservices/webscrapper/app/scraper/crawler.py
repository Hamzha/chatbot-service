import asyncio
import logging
from urllib.parse import urlparse, urljoin
from app.api.schemas import ScrapeMode, ScrapedData
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


async def crawl_website(
    start_url: str,
    mode: ScrapeMode = ScrapeMode.AUTO,
    max_pages: int = 50,
    max_depth: int = 3,
) -> tuple[list[ScrapedData], list[dict[str, str]]]:
    """
    Crawl an entire website starting from a URL.

    Returns:
        - List of scraped pages
        - List of failed URLs with error messages
    """
    visited: set[str] = set()
    pages: list[ScrapedData] = []
    failed: list[dict[str, str]] = []

    # Queue holds (url, depth) tuples
    queue: asyncio.Queue[tuple[str, int]] = asyncio.Queue()
    await queue.put((normalize_url(start_url), 0))
    visited.add(normalize_url(start_url))

    while not queue.empty() and len(pages) < max_pages:
        url, depth = await queue.get()

        logger.info(
            f"Crawling [{len(pages) + 1}/{max_pages}] depth={depth}: {url}"
        )

        try:
            data = await scrape(url=url, mode=mode)
            pages.append(data)

            # Don't follow links if we've hit max depth
            if depth >= max_depth:
                continue

            # Extract internal links and add to queue
            for link in data.links:
                href = link.get("href", "")
                if not href:
                    continue

                # Resolve relative URLs
                full_url = urljoin(url, href)
                normalized = normalize_url(full_url)

                # Only follow same-domain, unvisited, HTML-like URLs
                if (
                    normalized not in visited
                    and is_same_domain(start_url, full_url)
                    and not should_skip_url(full_url)
                    and len(visited) < max_pages
                ):
                    visited.add(normalized)
                    await queue.put((normalized, depth + 1))

        except Exception as e:
            logger.error(f"Failed to scrape {url}: {e}")
            failed.append({"url": url, "error": str(e)})

    logger.info(
        f"Crawl complete: {len(pages)} pages scraped, {len(failed)} failed"
    )
    return pages, failed
