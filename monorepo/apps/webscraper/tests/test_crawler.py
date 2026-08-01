"""Unit tests for the BFS crawler (`app.scraper.crawler`).

The real `scrape()` function hits the network, so every test in this module
monkey-patches `app.scraper.crawler.scrape` with a deterministic in-memory
site graph. This lets us assert the BFS, depth, domain, and event-emission
guarantees without any HTTP traffic.
"""
from __future__ import annotations

import pytest

from app.api.schemas import ScrapeMode, ScrapedData
from app.scraper import crawler as crawler_mod
from app.scraper.crawler import (
    crawl_website_stream,
    is_same_domain,
    normalize_url,
    should_skip_url,
)


# ---------------------------------------------------------------------------
# Helpers to build an in-memory site graph
# ---------------------------------------------------------------------------


def _page(url: str, links: list[str], *, title: str = "") -> ScrapedData:
    return ScrapedData(
        url=url,
        title=title or url,
        text_content=f"content for {url}",
        links=[{"text": href, "href": href} for href in links],
        mode_used="static",
    )


def _fake_site(pages: dict[str, list[str]]) -> dict[str, ScrapedData]:
    """Return a lookup from URL -> ScrapedData, using `pages` as graph."""
    return {url: _page(url, links) for url, links in pages.items()}


def _patch_scraper(monkeypatch: pytest.MonkeyPatch, site: dict[str, ScrapedData]) -> None:
    async def fake_scrape(url: str, mode: ScrapeMode = ScrapeMode.AUTO) -> ScrapedData:
        if url not in site:
            raise Exception(f"HTTP 404: {url}")
        return site[url]

    monkeypatch.setattr(crawler_mod, "scrape", fake_scrape)


async def _collect(agen) -> list[dict]:
    out: list[dict] = []
    async for evt in agen:
        out.append(evt)
    return out


# ---------------------------------------------------------------------------
# Pure-helper tests
# ---------------------------------------------------------------------------


class TestNormalizeUrl:
    def test_strips_fragment(self):
        assert normalize_url("https://x.com/a#section") == "https://x.com/a"

    def test_strips_trailing_slash_except_root(self):
        assert normalize_url("https://x.com/a/") == "https://x.com/a"
        assert normalize_url("https://x.com/") == "https://x.com/"

    def test_preserves_scheme_and_host(self):
        assert normalize_url("http://x.com/a") == "http://x.com/a"
        assert normalize_url("https://x.com/a") == "https://x.com/a"


class TestIsSameDomain:
    def test_same_host_is_same_domain(self):
        assert is_same_domain("https://a.com/x", "https://a.com/y")

    def test_different_host_is_not_same_domain(self):
        assert not is_same_domain("https://a.com/x", "https://b.com/y")

    def test_subdomain_is_not_same_domain(self):
        # Deliberate behaviour: we don't follow to subdomains.
        assert not is_same_domain("https://a.com/", "https://sub.a.com/")


class TestShouldSkipUrl:
    @pytest.mark.parametrize(
        "url",
        [
            "https://x.com/a.jpg",
            "https://x.com/doc.pdf",
            "https://x.com/file.zip",
            "https://x.com/font.woff2",
            "https://x.com/style.css",
        ],
    )
    def test_binary_and_asset_urls_are_skipped(self, url: str):
        assert should_skip_url(url)

    @pytest.mark.parametrize(
        "url",
        [
            "https://x.com/",
            "https://x.com/about",
            "https://x.com/services/physio",
            "https://x.com/page.html",
        ],
    )
    def test_html_like_urls_are_not_skipped(self, url: str):
        assert not should_skip_url(url)


# ---------------------------------------------------------------------------
# BFS / event-emission tests
# ---------------------------------------------------------------------------


class TestCrawlEventsShape:
    async def test_emits_exactly_one_start_and_one_done(self, monkeypatch):
        site = _fake_site({"https://x.com/": []})
        _patch_scraper(monkeypatch, site)

        events = await _collect(
            crawl_website_stream("https://x.com/", max_pages=5, max_depth=1)
        )

        starts = [e for e in events if e["type"] == "start"]
        dones = [e for e in events if e["type"] == "done"]
        assert len(starts) == 1
        assert len(dones) == 1
        # `start` must come first, `done` must come last.
        assert events[0]["type"] == "start"
        assert events[-1]["type"] == "done"

    async def test_single_page_emits_visiting_then_page(self, monkeypatch):
        site = _fake_site({"https://x.com/": []})
        _patch_scraper(monkeypatch, site)

        events = await _collect(
            crawl_website_stream("https://x.com/", max_pages=5, max_depth=1)
        )

        types = [e["type"] for e in events]
        assert types == ["start", "visiting", "page", "done"]

    async def test_done_reports_page_and_failed_counts(self, monkeypatch):
        site = _fake_site(
            {
                "https://x.com/": ["/ok", "/broken"],
                "https://x.com/ok": [],
                # /broken is intentionally absent → raises
            }
        )
        _patch_scraper(monkeypatch, site)

        events = await _collect(
            crawl_website_stream("https://x.com/", max_pages=10, max_depth=2)
        )

        done = events[-1]
        assert done["type"] == "done"
        assert done["total_pages"] == 2  # start page + /ok
        assert done["failed_count"] == 1  # /broken


class TestCrawlDepthLimit:
    async def test_max_depth_1_does_not_follow_beyond_children(self, monkeypatch):
        site = _fake_site(
            {
                "https://x.com/": ["/a"],
                "https://x.com/a": ["/a/deep"],
                "https://x.com/a/deep": [],
            }
        )
        _patch_scraper(monkeypatch, site)

        events = await _collect(
            crawl_website_stream("https://x.com/", max_pages=10, max_depth=1)
        )

        visited_urls = [e["url"] for e in events if e["type"] == "page"]
        assert "https://x.com/" in visited_urls  # normalized root keeps trailing slash
        assert "https://x.com/a" in visited_urls
        assert "https://x.com/a/deep" not in visited_urls

    async def test_max_depth_2_reaches_grandchildren(self, monkeypatch):
        site = _fake_site(
            {
                "https://x.com/": ["/a"],
                "https://x.com/a": ["/a/deep"],
                "https://x.com/a/deep": ["/a/deep/deeper"],
                "https://x.com/a/deep/deeper": [],
            }
        )
        _patch_scraper(monkeypatch, site)

        events = await _collect(
            crawl_website_stream("https://x.com/", max_pages=10, max_depth=2)
        )

        visited_urls = [e["url"] for e in events if e["type"] == "page"]
        assert "https://x.com/a/deep" in visited_urls
        # max_depth=2 means the grandchild page is visited (depth 2), but its
        # own links (depth 3) are NOT followed.
        assert "https://x.com/a/deep/deeper" not in visited_urls

    async def test_page_event_carries_correct_depth(self, monkeypatch):
        site = _fake_site(
            {
                "https://x.com/": ["/child"],
                "https://x.com/child": [],
            }
        )
        _patch_scraper(monkeypatch, site)

        events = await _collect(
            crawl_website_stream("https://x.com/", max_pages=5, max_depth=2)
        )

        depths_by_url = {
            e["url"]: e["depth"] for e in events if e["type"] == "page"
        }
        assert depths_by_url["https://x.com/"] == 0
        assert depths_by_url["https://x.com/child"] == 1


class TestCrawlPageCap:
    async def test_respects_max_pages(self, monkeypatch):
        # Root links out to 5 pages; with max_pages=3 we should scrape only 3.
        site = _fake_site(
            {
                "https://x.com/": [f"/p{i}" for i in range(5)],
                **{f"https://x.com/p{i}": [] for i in range(5)},
            }
        )
        _patch_scraper(monkeypatch, site)

        events = await _collect(
            crawl_website_stream("https://x.com/", max_pages=3, max_depth=2)
        )

        page_events = [e for e in events if e["type"] == "page"]
        assert len(page_events) == 3


class TestCrawlDomainFiltering:
    async def test_off_domain_links_are_ignored(self, monkeypatch):
        site = _fake_site(
            {
                "https://x.com/": [
                    "https://other.com/out",
                    "/same",
                ],
                "https://x.com/same": [],
            }
        )
        # `other.com/out` will never be visited, but we still need it absent
        # from the lookup so an accidental hit raises visibly.
        _patch_scraper(monkeypatch, site)

        events = await _collect(
            crawl_website_stream("https://x.com/", max_pages=10, max_depth=2)
        )

        visited = {e["url"] for e in events if e["type"] == "page"}
        assert visited == {"https://x.com/", "https://x.com/same"}

    async def test_asset_links_are_skipped(self, monkeypatch):
        site = _fake_site(
            {
                "https://x.com/": ["/brochure.pdf", "/logo.png", "/real"],
                "https://x.com/real": [],
            }
        )
        _patch_scraper(monkeypatch, site)

        events = await _collect(
            crawl_website_stream("https://x.com/", max_pages=10, max_depth=2)
        )

        visited = {e["url"] for e in events if e["type"] == "page"}
        # Only same-domain HTML pages should be visited.
        assert visited == {"https://x.com/", "https://x.com/real"}

    async def test_fragment_only_anchors_dedupe_to_root(self, monkeypatch):
        # Typical one-pager: all nav items point to #section.
        site = _fake_site(
            {"https://x.com/": ["#services", "#about", "#contact"]}
        )
        _patch_scraper(monkeypatch, site)

        events = await _collect(
            crawl_website_stream("https://x.com/", max_pages=10, max_depth=2)
        )

        # Only the root page is scraped; fragments normalize back to root
        # which is already in `visited`.
        page_events = [e for e in events if e["type"] == "page"]
        assert len(page_events) == 1
        assert page_events[0]["url"] == "https://x.com/"


class TestCrawlFailureTolerance:
    async def test_failed_page_does_not_abort_crawl(self, monkeypatch):
        site = _fake_site(
            {
                "https://x.com/": ["/broken", "/ok"],
                # /broken missing → raises; /ok scrapes fine
                "https://x.com/ok": [],
            }
        )
        _patch_scraper(monkeypatch, site)

        events = await _collect(
            crawl_website_stream("https://x.com/", max_pages=10, max_depth=2)
        )

        failed = [e for e in events if e["type"] == "failed"]
        pages = [e for e in events if e["type"] == "page"]
        assert len(failed) == 1
        assert failed[0]["url"] == "https://x.com/broken"
        # crawl continued, so we still got root + /ok
        assert {p["url"] for p in pages} == {
            "https://x.com/",
            "https://x.com/ok",
        }

    async def test_failed_event_includes_error_string(self, monkeypatch):
        async def fake_scrape(url: str, mode: ScrapeMode = ScrapeMode.AUTO) -> ScrapedData:
            raise RuntimeError("boom")

        monkeypatch.setattr(crawler_mod, "scrape", fake_scrape)

        events = await _collect(
            crawl_website_stream("https://x.com/", max_pages=1, max_depth=1)
        )

        failed = [e for e in events if e["type"] == "failed"]
        assert len(failed) == 1
        assert "boom" in failed[0]["error"]


# ---------------------------------------------------------------------------
# Redirect handling — real-world regression: heartlandrehab.com → gentivahs.com
# ---------------------------------------------------------------------------


class TestCrawlFollowsCrossDomainRedirect:
    """When the start URL redirects to a new host, the crawler must:

      1. Report the page event under its FINAL URL (not the input URL).
      2. Resolve relative links against the new host.
      3. Scope the same-domain filter to the new (redirected) host.
    """

    async def test_relative_links_resolve_against_redirected_host(
        self, monkeypatch
    ):
        site = {
            # Start page: redirected target (note the different host).
            "https://old.com/": _page("https://new.com/", ["/about", "/services"]),
            # Child pages live on the NEW host.
            "https://new.com/about": _page("https://new.com/about", []),
            "https://new.com/services": _page("https://new.com/services", []),
        }

        async def fake_scrape(url: str, mode: ScrapeMode = ScrapeMode.AUTO) -> ScrapedData:
            if url not in site:
                raise Exception(f"HTTP 404: {url}")
            return site[url]

        monkeypatch.setattr(crawler_mod, "scrape", fake_scrape)

        events = await _collect(
            crawl_website_stream("https://old.com/", max_pages=10, max_depth=2)
        )

        visited = {e["url"] for e in events if e["type"] == "page"}
        # First page event reports the final URL, not old.com.
        assert "https://new.com/" in visited
        # Relative children were resolved against the new host and scraped.
        assert "https://new.com/about" in visited
        assert "https://new.com/services" in visited
        # Crucially, the OLD-host versions were never queued → never 404ed.
        assert "https://old.com/about" not in visited
        assert "https://old.com/services" not in visited

    async def test_failed_count_is_zero_after_redirect(self, monkeypatch):
        site = {
            "https://old.com/": _page("https://new.com/", ["/child"]),
            "https://new.com/child": _page("https://new.com/child", []),
        }

        async def fake_scrape(url: str, mode: ScrapeMode = ScrapeMode.AUTO) -> ScrapedData:
            if url not in site:
                raise Exception(f"HTTP 404: {url}")
            return site[url]

        monkeypatch.setattr(crawler_mod, "scrape", fake_scrape)

        events = await _collect(
            crawl_website_stream("https://old.com/", max_pages=10, max_depth=2)
        )

        done = events[-1]
        assert done["type"] == "done"
        # No spurious 404s on the old (defunct) host.
        assert done["failed_count"] == 0
        assert done["total_pages"] == 2

    async def test_child_links_to_original_host_are_treated_as_offdomain(
        self, monkeypatch
    ):
        """After a cross-domain redirect, stray links back to the OLD host
        should be dropped as off-domain, not re-fetched."""
        site = {
            "https://old.com/": _page(
                "https://new.com/",
                # Child HTML contains a link back to the old host; shouldn't be crawled.
                ["/good", "https://old.com/legacy-page"],
            ),
            "https://new.com/good": _page("https://new.com/good", []),
        }

        async def fake_scrape(url: str, mode: ScrapeMode = ScrapeMode.AUTO) -> ScrapedData:
            if url not in site:
                raise Exception(f"HTTP 404: {url}")
            return site[url]

        monkeypatch.setattr(crawler_mod, "scrape", fake_scrape)

        events = await _collect(
            crawl_website_stream("https://old.com/", max_pages=10, max_depth=2)
        )

        visited = {e["url"] for e in events if e["type"] == "page"}
        assert "https://new.com/" in visited
        assert "https://new.com/good" in visited
        assert "https://old.com/legacy-page" not in visited

    async def test_self_link_on_landing_page_is_not_rescrapped(
        self, monkeypatch
    ):
        """After a redirect, a `<a href="/">Home</a>` on the landing page
        must not cause us to scrape the landing page again."""
        site = {
            "https://old.com/": _page(
                "https://new.com/",
                # Self-link back to root + a real child.
                ["/", "/deep"],
            ),
            "https://new.com/deep": _page("https://new.com/deep", []),
        }

        async def fake_scrape(url: str, mode: ScrapeMode = ScrapeMode.AUTO) -> ScrapedData:
            if url not in site:
                raise Exception(f"HTTP 404: {url}")
            return site[url]

        monkeypatch.setattr(crawler_mod, "scrape", fake_scrape)

        events = await _collect(
            crawl_website_stream("https://old.com/", max_pages=10, max_depth=2)
        )

        page_urls = [e["url"] for e in events if e["type"] == "page"]
        # Exactly one visit to the landing page, plus /deep.
        assert page_urls.count("https://new.com/") == 1
        assert "https://new.com/deep" in page_urls

    async def test_no_redirect_behaviour_unchanged(self, monkeypatch):
        """Regression guard: same-host crawls keep working exactly as before."""
        site = {
            # No redirect — scrape returns the same URL it was given.
            "https://x.com/": _page("https://x.com/", ["/a"]),
            "https://x.com/a": _page("https://x.com/a", []),
        }

        async def fake_scrape(url: str, mode: ScrapeMode = ScrapeMode.AUTO) -> ScrapedData:
            return site[url]

        monkeypatch.setattr(crawler_mod, "scrape", fake_scrape)

        events = await _collect(
            crawl_website_stream("https://x.com/", max_pages=10, max_depth=2)
        )
        visited = {e["url"] for e in events if e["type"] == "page"}
        assert visited == {"https://x.com/", "https://x.com/a"}
