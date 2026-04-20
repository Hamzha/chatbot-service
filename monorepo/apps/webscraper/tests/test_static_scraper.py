"""Tests for `app.scraper.static_scraper.fetch_static`.

The function must return both the HTML body AND the final URL after
redirects, so callers resolving relative links use the right base.
"""
from __future__ import annotations

import httpx
import pytest
import respx

from app.scraper.static_scraper import fetch_static


@pytest.fixture(autouse=True)
def _clear_settings():
    from app.config import get_settings
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@respx.mock
async def test_returns_html_and_same_url_when_no_redirect():
    respx.get("https://example.com/").mock(
        return_value=httpx.Response(200, html="<html>hi</html>")
    )
    html, final_url = await fetch_static("https://example.com/")

    assert "hi" in html
    assert final_url == "https://example.com/"


@respx.mock
async def test_returns_final_url_after_same_host_redirect():
    respx.get("https://example.com/old").mock(
        return_value=httpx.Response(301, headers={"Location": "/new"})
    )
    respx.get("https://example.com/new").mock(
        return_value=httpx.Response(200, html="<html>new</html>")
    )

    html, final_url = await fetch_static("https://example.com/old")
    assert "new" in html
    assert final_url == "https://example.com/new"


@respx.mock
async def test_returns_final_url_after_cross_host_redirect():
    """The heartlandrehab.com → www.gentivahs.com case."""
    respx.get("https://old.com/").mock(
        return_value=httpx.Response(301, headers={"Location": "https://new.com/"})
    )
    respx.get("https://new.com/").mock(
        return_value=httpx.Response(200, html="<html>relocated</html>")
    )

    html, final_url = await fetch_static("https://old.com/")
    assert "relocated" in html
    assert final_url == "https://new.com/"


@respx.mock
async def test_raises_on_404():
    respx.get("https://example.com/missing").mock(
        return_value=httpx.Response(404)
    )
    with pytest.raises(Exception, match=r"HTTP 404"):
        await fetch_static("https://example.com/missing")


@respx.mock
async def test_raises_on_500():
    respx.get("https://example.com/boom").mock(
        return_value=httpx.Response(500)
    )
    with pytest.raises(Exception, match=r"HTTP 500"):
        await fetch_static("https://example.com/boom")
