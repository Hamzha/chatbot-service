import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.api.schemas import ScrapeRequest, ScrapeResponse, CrawlRequest
from app.scraper.factory import scrape
from app.scraper.crawler import crawl_website_stream
from app.config import get_settings
from urllib.parse import urlparse

router = APIRouter()


def _check_domain(url: str) -> None:
    settings = get_settings()
    if settings.allowed_domains:
        hostname = urlparse(url).hostname
        if hostname not in settings.allowed_domains:
            raise HTTPException(
                status_code=403,
                detail=f"Domain '{hostname}' is not in the allowed list",
            )


@router.post("/scrape", response_model=ScrapeResponse)
async def scrape_url(request: ScrapeRequest):
    """Scrape a URL and return structured data."""

    _check_domain(str(request.url))

    try:
        data = await scrape(
            url=str(request.url),
            mode=request.mode,
            wait_for_selector=request.wait_for_selector,
        )
        return ScrapeResponse(success=True, data=data)
    except Exception as e:
        return ScrapeResponse(success=False, error=str(e))


@router.post("/crawl/stream")
async def crawl_stream(request: CrawlRequest):
    """Crawl a website and stream progress as NDJSON. One JSON event per line.

    Consumed by the Next.js crawl-job worker (`lib/scraper/crawlJobWorker.ts`).
    """

    _check_domain(str(request.url))

    async def event_generator():
        try:
            async for evt in crawl_website_stream(
                start_url=str(request.url),
                mode=request.mode,
                max_pages=request.max_pages,
                max_depth=request.max_depth,
            ):
                yield json.dumps(evt) + "\n"
        except Exception as e:
            yield json.dumps({"type": "error", "error": str(e)}) + "\n"

    return StreamingResponse(
        event_generator(),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )
