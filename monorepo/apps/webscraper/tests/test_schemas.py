"""Validator tests for the request schemas (`app.api.schemas`)."""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.api.schemas import CrawlRequest, ScrapeRequest


# ---------------------------------------------------------------------------
# Shared SSRF / scheme checks — applied to both ScrapeRequest and CrawlRequest
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "url",
    [
        "http://localhost/",
        "http://127.0.0.1/",
        "http://0.0.0.0/",
        "http://[::1]/",
    ],
)
class TestSsrfBlocksLoopbackHostnames:
    def test_scrape_rejects(self, url):
        with pytest.raises(ValidationError):
            ScrapeRequest(url=url)

    def test_crawl_rejects(self, url):
        with pytest.raises(ValidationError):
            CrawlRequest(url=url)


@pytest.mark.parametrize(
    "url",
    [
        "http://10.0.0.1/",
        "http://192.168.1.1/",
        "http://172.16.0.1/",
    ],
)
class TestSsrfBlocksPrivateIps:
    def test_scrape_rejects(self, url):
        with pytest.raises(ValidationError):
            ScrapeRequest(url=url)

    def test_crawl_rejects(self, url):
        with pytest.raises(ValidationError):
            CrawlRequest(url=url)


@pytest.mark.parametrize(
    "url",
    [
        "ftp://example.com/",
        "file:///etc/passwd",
        "gopher://example.com/",
    ],
)
class TestSchemeRestriction:
    def test_scrape_rejects_non_http(self, url):
        with pytest.raises(ValidationError):
            ScrapeRequest(url=url)

    def test_crawl_rejects_non_http(self, url):
        with pytest.raises(ValidationError):
            CrawlRequest(url=url)


class TestSchemePositives:
    @pytest.mark.parametrize("url", ["http://example.com/", "https://example.com/"])
    def test_http_and_https_accepted(self, url):
        # Should not raise.
        ScrapeRequest(url=url)
        CrawlRequest(url=url)


# ---------------------------------------------------------------------------
# Crawl-specific bounds
# ---------------------------------------------------------------------------


class TestCrawlMaxPagesBounds:
    def test_zero_is_rejected(self):
        with pytest.raises(ValidationError):
            CrawlRequest(url="https://x.com/", max_pages=0)

    def test_over_max_is_rejected(self):
        with pytest.raises(ValidationError):
            CrawlRequest(url="https://x.com/", max_pages=201)

    @pytest.mark.parametrize("v", [1, 50, 200])
    def test_in_range_is_accepted(self, v):
        CrawlRequest(url="https://x.com/", max_pages=v)


class TestCrawlMaxDepthBounds:
    def test_zero_is_rejected(self):
        with pytest.raises(ValidationError):
            CrawlRequest(url="https://x.com/", max_depth=0)

    def test_over_max_is_rejected(self):
        with pytest.raises(ValidationError):
            CrawlRequest(url="https://x.com/", max_depth=11)

    @pytest.mark.parametrize("v", [1, 3, 10])
    def test_in_range_is_accepted(self, v):
        CrawlRequest(url="https://x.com/", max_depth=v)


class TestCrawlDefaults:
    def test_defaults_match_spec(self):
        req = CrawlRequest(url="https://x.com/")
        assert req.max_pages == 50
        assert req.max_depth == 3
        assert req.mode.value == "auto"
