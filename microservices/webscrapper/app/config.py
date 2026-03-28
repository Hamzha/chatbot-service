from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # API authentication
    api_key: str = ""

    # Domain restrictions (empty = allow all)
    allowed_domains: list[str] = []

    # Scraping
    request_timeout_seconds: int = 30
    playwright_timeout_ms: int = 30000
    max_concurrent_requests: int = 10
    max_retries: int = 3
    retry_backoff_base: float = 2.0

    # Rate limiting
    rate_limit_per_minute: int = 60

    model_config = {"env_file": ".env", "env_prefix": "SCRAPER_"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
