import logging
from typing import Optional
from app.api.schemas import ScrapeMode, ScrapedData
from app.scraper.static_scraper import fetch_static
from app.scraper.dynamic_scraper import fetch_dynamic
from app.scraper.detector import is_dynamic_content
from app.scraper.parser import parse_html
from app.anti_block.retry import retry_with_backoff

logger = logging.getLogger(__name__)


async def scrape(
    url: str,
    mode: ScrapeMode = ScrapeMode.AUTO,
    wait_for_selector: Optional[str] = None,
) -> ScrapedData:
    """
    Main scraping entrypoint. Picks the right strategy and returns structured data.

    Flow:
    1. If mode is "static" or "dynamic" → use that directly
    2. If mode is "auto" → fetch with httpx first, detect if dynamic
    3. Parse the HTML into structured data
    """

    if mode == ScrapeMode.STATIC:
        html = await retry_with_backoff(fetch_static, url)
        return parse_html(html, url, mode_used="static")

    if mode == ScrapeMode.DYNAMIC:
        html = await retry_with_backoff(fetch_dynamic, url, wait_for_selector)
        return parse_html(html, url, mode_used="dynamic")

    # AUTO mode: try static first, detect if we need dynamic
    logger.info(f"Auto-detecting scrape mode for {url}")
    html = await retry_with_backoff(fetch_static, url)

    if is_dynamic_content(html):
        logger.info(f"Detected dynamic content, switching to Playwright: {url}")
        html = await retry_with_backoff(fetch_dynamic, url, wait_for_selector)
        return parse_html(html, url, mode_used="dynamic")

    logger.info(f"Static content detected: {url}")
    return parse_html(html, url, mode_used="static")
