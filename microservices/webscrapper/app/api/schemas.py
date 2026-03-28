from pydantic import BaseModel, HttpUrl, field_validator
from typing import Optional
from enum import Enum
import ipaddress
from urllib.parse import urlparse


class ScrapeMode(str, Enum):
    AUTO = "auto"
    STATIC = "static"
    DYNAMIC = "dynamic"


class ScrapeRequest(BaseModel):
    url: HttpUrl
    mode: ScrapeMode = ScrapeMode.AUTO
    wait_for_selector: Optional[str] = None  # CSS selector to wait for (dynamic mode)

    @field_validator("url")
    @classmethod
    def validate_url_safety(cls, v):
        """Prevent SSRF - block internal/private URLs."""
        parsed = urlparse(str(v))
        hostname = parsed.hostname or ""

        # Block private/internal hostnames
        blocked = ["localhost", "127.0.0.1", "0.0.0.0", "::1"]
        if hostname in blocked:
            raise ValueError("Internal URLs are not allowed")

        # Block private IP ranges
        try:
            ip = ipaddress.ip_address(hostname)
            if ip.is_private or ip.is_loopback or ip.is_reserved:
                raise ValueError("Private/reserved IP addresses are not allowed")
        except ValueError as e:
            if "not allowed" in str(e):
                raise
            # Not an IP address (it's a hostname) - that's fine

        # Block non-HTTP schemes
        if parsed.scheme not in ("http", "https"):
            raise ValueError("Only http and https URLs are allowed")

        return v


class ScrapedData(BaseModel):
    url: str
    title: Optional[str] = None
    meta_description: Optional[str] = None
    headings: dict[str, list[str]] = {}   # {"h1": [...], "h2": [...]}
    links: list[dict[str, str]] = []       # [{"text": "...", "href": "..."}]
    images: list[dict[str, str]] = []      # [{"alt": "...", "src": "..."}]
    text_content: str = ""                  # All visible text
    tables: list[list[list[str]]] = []     # List of tables, each is rows of cells
    mode_used: str = ""                     # "static" or "dynamic"


class ScrapeResponse(BaseModel):
    success: bool
    data: Optional[ScrapedData] = None
    error: Optional[str] = None


class CrawlRequest(BaseModel):
    url: HttpUrl
    mode: ScrapeMode = ScrapeMode.AUTO
    max_pages: int = 50       # Max total pages to crawl
    max_depth: int = 3        # How deep to follow links

    @field_validator("url")
    @classmethod
    def validate_url_safety(cls, v):
        """Prevent SSRF - block internal/private URLs."""
        parsed = urlparse(str(v))
        hostname = parsed.hostname or ""

        blocked = ["localhost", "127.0.0.1", "0.0.0.0", "::1"]
        if hostname in blocked:
            raise ValueError("Internal URLs are not allowed")

        try:
            ip = ipaddress.ip_address(hostname)
            if ip.is_private or ip.is_loopback or ip.is_reserved:
                raise ValueError("Private/reserved IP addresses are not allowed")
        except ValueError as e:
            if "not allowed" in str(e):
                raise

        if parsed.scheme not in ("http", "https"):
            raise ValueError("Only http and https URLs are allowed")

        return v

    @field_validator("max_pages")
    @classmethod
    def validate_max_pages(cls, v):
        if v < 1 or v > 200:
            raise ValueError("max_pages must be between 1 and 200")
        return v

    @field_validator("max_depth")
    @classmethod
    def validate_max_depth(cls, v):
        if v < 1 or v > 10:
            raise ValueError("max_depth must be between 1 and 10")
        return v


class CrawlResponse(BaseModel):
    success: bool
    total_pages: int = 0
    pages: list[ScrapedData] = []
    failed_urls: list[dict[str, str]] = []  # [{"url": "...", "error": "..."}]
    error: Optional[str] = None
