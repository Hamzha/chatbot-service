import asyncio
import logging
from typing import Callable, TypeVar
from app.config import get_settings

logger = logging.getLogger(__name__)
T = TypeVar("T")

# Status codes that are worth retrying
RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}


async def retry_with_backoff(func: Callable, *args, **kwargs) -> T:
    """
    Retry an async function with exponential backoff.

    Retries on connection errors and retryable HTTP status codes.
    Does NOT retry on 403/404 (those need a different strategy).
    """
    settings = get_settings()
    last_exception = None

    for attempt in range(settings.max_retries + 1):
        try:
            result = await func(*args, **kwargs)
            return result
        except Exception as e:
            last_exception = e
            error_msg = str(e)

            # Check if it's a retryable HTTP error
            is_retryable = any(
                str(code) in error_msg for code in RETRYABLE_STATUS_CODES
            )

            # Also retry on connection/timeout errors
            is_connection_error = any(
                keyword in error_msg.lower()
                for keyword in ["timeout", "connection", "network", "reset"]
            )

            if not (is_retryable or is_connection_error):
                raise  # Non-retryable error, fail immediately

            if attempt < settings.max_retries:
                delay = settings.retry_backoff_base ** attempt
                logger.warning(
                    f"Attempt {attempt + 1} failed: {error_msg}. "
                    f"Retrying in {delay}s..."
                )
                await asyncio.sleep(delay)
            else:
                logger.error(
                    f"All {settings.max_retries + 1} attempts failed: {error_msg}"
                )

    raise last_exception
