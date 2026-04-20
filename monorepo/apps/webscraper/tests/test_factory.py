"""Tests for `app.scraper.factory.scrape`.

`ScrapedData.url` must reflect the **final** URL after any redirects so
downstream consumers (notably the BFS crawler) resolve relative links
against the right host.
"""
from __future__ import annotations

import pytest

from app.api.schemas import ScrapeMode
from app.scraper import factory as factory_mod


@pytest.fixture
def patch_static(monkeypatch):
    """Helper: patch `fetch_static` with a canned (html, final_url) tuple."""
    def _patch(html: str, final_url: str):
        async def fake(_url: str):
            return html, final_url
        monkeypatch.setattr(factory_mod, "fetch_static", fake)
    return _patch


async def test_scrape_static_sets_url_to_final_url_after_redirect(patch_static):
    """heartlandrehab.com/ → www.gentivahs.com/ case."""
    html = '<html><head><title>New Site</title></head><body>hello</body></html>'
    patch_static(html, "https://www.gentivahs.com/")

    data = await factory_mod.scrape(
        url="https://heartlandrehab.com/",
        mode=ScrapeMode.STATIC,
    )

    assert data.url == "https://www.gentivahs.com/"
    assert data.title == "New Site"
    assert data.mode_used == "static"


async def test_scrape_static_keeps_url_when_no_redirect(patch_static):
    html = '<html><head><title>Stable</title></head><body>ok</body></html>'
    patch_static(html, "https://example.com/")

    data = await factory_mod.scrape(
        url="https://example.com/",
        mode=ScrapeMode.STATIC,
    )

    assert data.url == "https://example.com/"


async def test_scrape_auto_sets_url_to_final_url_when_static_wins(
    patch_static, monkeypatch
):
    """AUTO mode that doesn't trigger Playwright should still propagate the final URL."""
    html = '<html><head><title>A</title></head><body>plain</body></html>'
    patch_static(html, "https://redirected.com/new")

    # Force "static is enough" classification so we don't need Playwright.
    monkeypatch.setattr(factory_mod, "is_dynamic_content", lambda _h: False)

    data = await factory_mod.scrape(
        url="https://start.com/",
        mode=ScrapeMode.AUTO,
    )

    assert data.url == "https://redirected.com/new"
    assert data.mode_used == "static"


async def test_scrape_dynamic_sets_url_to_final_url_after_redirect(monkeypatch):
    """Playwright's `page.url` may differ from the goto URL — propagate it."""
    html = '<html><head><title>Dyn</title></head><body>spa</body></html>'

    async def fake_dynamic(_url, _selector=None):
        return html, "https://www.gentivahs.com/"

    monkeypatch.setattr(factory_mod, "fetch_dynamic", fake_dynamic)

    data = await factory_mod.scrape(
        url="https://heartlandrehab.com/",
        mode=ScrapeMode.DYNAMIC,
    )

    assert data.url == "https://www.gentivahs.com/"
    assert data.mode_used == "dynamic"
