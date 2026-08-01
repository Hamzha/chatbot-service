import asyncio
import logging
from typing import Optional
from functools import partial
from playwright.sync_api import sync_playwright
from app.anti_block.headers import get_random_headers
from app.config import get_settings

logger = logging.getLogger(__name__)


def _run_playwright_sync(
    url: str,
    wait_for_selector: Optional[str],
    headers: dict,
    timeout_ms: int,
) -> tuple[str, str]:
    """Run Playwright in sync mode (called from a thread).

    Returns `(html, final_url)` — `final_url` is `page.url` AFTER navigation,
    which reflects any redirects or client-side navigations.
    """
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-gpu",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled",
            ],
        )

        context = browser.new_context(
            user_agent=headers["User-Agent"],
            viewport={"width": 1920, "height": 1080},
            locale="en-US",
        )

        page = context.new_page()

        try:
            page.goto(url, timeout=timeout_ms, wait_until="networkidle")

            if wait_for_selector:
                page.wait_for_selector(wait_for_selector, timeout=timeout_ms)

            html = page.content()
            final_url = page.url
            if final_url != url:
                logger.info(f"Dynamic fetch OK: {url} → {final_url}")
            else:
                logger.info(f"Dynamic fetch OK: {url}")
            return html, final_url

        finally:
            context.close()
            browser.close()


async def fetch_dynamic(
    url: str, wait_for_selector: Optional[str] = None
) -> tuple[str, str]:
    """Fetch fully rendered HTML using Playwright (handles JavaScript).

    Returns `(html, final_url)`.
    """
    settings = get_settings()
    headers = get_random_headers()

    # Run sync Playwright in a separate thread to avoid Windows event loop issues
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        partial(
            _run_playwright_sync,
            url,
            wait_for_selector,
            headers,
            settings.playwright_timeout_ms,
        ),
    )
    return result
