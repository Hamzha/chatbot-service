"""Router-level tests for the FastAPI scraper service.

These tests stub `app.scraper.factory.scrape` and the BFS streaming crawler so
they never hit the network, and flip `Settings.allowed_domains` to verify the
domain allowlist.
"""
from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app.api import router as router_mod
from app.api.schemas import ScrapeMode, ScrapedData
from app.config import get_settings
from app.main import app


@pytest.fixture(autouse=True)
def _reset_settings_cache():
    """Clear cached Settings between tests so env overrides take effect."""
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def _fake_scraped_data(url: str) -> ScrapedData:
    return ScrapedData(
        url=url,
        title="Test",
        text_content="hello",
        links=[],
        mode_used="static",
    )


# ---------------------------------------------------------------------------
# Scrape endpoint — success + domain allowlist
# ---------------------------------------------------------------------------


class TestScrapeEndpoint:
    def test_200_on_allowed_domain(self, monkeypatch, client):
        async def fake_scrape(url: str, mode: ScrapeMode, wait_for_selector=None):
            return _fake_scraped_data(url)

        monkeypatch.setattr(router_mod, "scrape", fake_scrape)

        res = client.post(
            "/api/v1/scrape",
            json={"url": "https://allowed.com/page"},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["success"] is True
        assert body["data"]["url"] == "https://allowed.com/page"

    def test_403_when_domain_not_in_allowlist(
        self, monkeypatch, client
    ):
        monkeypatch.setenv("SCRAPER_ALLOWED_DOMAINS", '["allowed.com"]')
        get_settings.cache_clear()

        res = client.post(
            "/api/v1/scrape",
            json={"url": "https://denied.com/page"},
        )
        assert res.status_code == 403
        assert "not in the allowed list" in res.json()["detail"]

    def test_200_when_domain_is_in_allowlist(self, monkeypatch, client):
        monkeypatch.setenv("SCRAPER_ALLOWED_DOMAINS", '["allowed.com"]')
        get_settings.cache_clear()

        async def fake_scrape(url: str, mode: ScrapeMode, wait_for_selector=None):
            return _fake_scraped_data(url)

        monkeypatch.setattr(router_mod, "scrape", fake_scrape)

        res = client.post(
            "/api/v1/scrape",
            json={"url": "https://allowed.com/page"},
        )
        assert res.status_code == 200

    def test_422_on_ssrf_url(self, client):
        res = client.post(
            "/api/v1/scrape", json={"url": "http://127.0.0.1/"}
        )
        assert res.status_code == 422

    def test_success_false_on_scrape_exception(self, monkeypatch, client):
        async def boom(url: str, mode: ScrapeMode, wait_for_selector=None):
            raise RuntimeError("network exploded")

        monkeypatch.setattr(router_mod, "scrape", boom)

        res = client.post("/api/v1/scrape", json={"url": "https://example.com/"})
        assert res.status_code == 200
        body = res.json()
        assert body["success"] is False
        assert "network exploded" in body["error"]


# ---------------------------------------------------------------------------
# Streaming crawl endpoint — NDJSON format + allowlist enforcement
# ---------------------------------------------------------------------------


class TestCrawlStreamEndpoint:
    def test_403_when_domain_not_in_allowlist(self, monkeypatch, client):
        monkeypatch.setenv("SCRAPER_ALLOWED_DOMAINS", '["allowed.com"]')
        get_settings.cache_clear()

        res = client.post(
            "/api/v1/crawl/stream",
            json={"url": "https://denied.com/"},
        )
        assert res.status_code == 403

    def test_streams_ndjson_events(self, monkeypatch, client):
        async def fake_stream(
            start_url: str,
            mode: ScrapeMode = ScrapeMode.AUTO,
            max_pages: int = 50,
            max_depth: int = 3,
        ):
            yield {
                "type": "start",
                "start_url": start_url,
                "max_pages": max_pages,
                "max_depth": max_depth,
            }
            yield {
                "type": "page",
                "url": start_url,
                "depth": 0,
                "index": 1,
                "data": {"url": start_url, "text_content": "hi"},
            }
            yield {"type": "done", "total_pages": 1, "failed_count": 0}

        monkeypatch.setattr(router_mod, "crawl_website_stream", fake_stream)

        res = client.post(
            "/api/v1/crawl/stream",
            json={"url": "https://example.com/", "max_pages": 1, "max_depth": 1},
        )
        assert res.status_code == 200
        assert res.headers["content-type"].startswith("application/x-ndjson")

        lines = [l for l in res.text.splitlines() if l.strip()]
        events = [json.loads(l) for l in lines]
        assert [e["type"] for e in events] == ["start", "page", "done"]

    def test_stream_emits_error_event_on_upstream_failure(self, monkeypatch, client):
        async def boom_stream(
            start_url: str,
            mode: ScrapeMode = ScrapeMode.AUTO,
            max_pages: int = 50,
            max_depth: int = 3,
        ):
            yield {
                "type": "start",
                "start_url": start_url,
                "max_pages": max_pages,
                "max_depth": max_depth,
            }
            raise RuntimeError("crawler crashed")

        monkeypatch.setattr(router_mod, "crawl_website_stream", boom_stream)

        res = client.post(
            "/api/v1/crawl/stream",
            json={"url": "https://example.com/"},
        )
        assert res.status_code == 200
        lines = [l for l in res.text.splitlines() if l.strip()]
        events = [json.loads(l) for l in lines]
        # Last event must be the synthetic error frame the router yields.
        assert events[-1]["type"] == "error"
        assert "crashed" in events[-1]["error"]


# ---------------------------------------------------------------------------
# Health endpoint (sanity)
# ---------------------------------------------------------------------------


class TestHealth:
    def test_health_endpoint_returns_ok(self, client):
        res = client.get("/health")
        assert res.status_code == 200
        assert res.json() == {"status": "ok"}
