from fastapi import APIRouter, HTTPException
from app.api.schemas import ScrapeRequest, ScrapeResponse, CrawlRequest, CrawlResponse
from app.scraper.factory import scrape
from app.scraper.crawler import crawl_website
from app.config import get_settings
from urllib.parse import urlparse

router = APIRouter()


@router.post("/scrape", response_model=ScrapeResponse)
async def scrape_url(request: ScrapeRequest):
    """Scrape a URL and return structured data."""

    # Check domain allowlist
    settings = get_settings()
    if settings.allowed_domains:
        hostname = urlparse(str(request.url)).hostname
        if hostname not in settings.allowed_domains:
            raise HTTPException(
                status_code=403,
                detail=f"Domain '{hostname}' is not in the allowed list",
            )

    try:
        data = await scrape(
            url=str(request.url),
            mode=request.mode,
            wait_for_selector=request.wait_for_selector,
        )
        return ScrapeResponse(success=True, data=data)
    except Exception as e:
        return ScrapeResponse(success=False, error=str(e))


@router.post("/crawl", response_model=CrawlResponse)
async def crawl_url(request: CrawlRequest):
    """Crawl an entire website and return structured data for all pages."""

    # Check domain allowlist
    settings = get_settings()
    if settings.allowed_domains:
        hostname = urlparse(str(request.url)).hostname
        if hostname not in settings.allowed_domains:
            raise HTTPException(
                status_code=403,
                detail=f"Domain '{hostname}' is not in the allowed list",
            )

    try:
        pages, failed = await crawl_website(
            start_url=str(request.url),
            mode=request.mode,
            max_pages=request.max_pages,
            max_depth=request.max_depth,
        )
        return CrawlResponse(
            success=True,
            total_pages=len(pages),
            pages=pages,
            failed_urls=failed,
        )
    except Exception as e:
        return CrawlResponse(success=False, error=str(e))
