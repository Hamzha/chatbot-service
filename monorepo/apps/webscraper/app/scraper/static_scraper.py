import httpx
import logging
from app.anti_block.headers import get_random_headers
from app.config import get_settings

logger = logging.getLogger(__name__)


async def fetch_static(url: str) -> str:
    """Fetch HTML from a URL using httpx (no JavaScript rendering)."""
    settings = get_settings()
    headers = get_random_headers()

    async with httpx.AsyncClient(
        timeout=settings.request_timeout_seconds,
        follow_redirects=True,
        headers=headers,
    ) as client:
        response = await client.get(url)

        if response.status_code >= 400:
            raise Exception(
                f"HTTP {response.status_code}: Failed to fetch {url}"
            )

        logger.info(f"Static fetch OK: {url} ({response.status_code})")
        return response.text
