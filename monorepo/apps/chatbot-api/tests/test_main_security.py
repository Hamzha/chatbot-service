from __future__ import annotations

from io import BytesIO
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from starlette.requests import Request

from app.auth import AuthenticatedUser, resolve_authenticated_user
from app.main import app, unhandled_exception_handler, inngest_client
from app.config import settings


@pytest.fixture(autouse=True)
def clear_dependency_overrides():
    app.dependency_overrides = {}
    yield
    app.dependency_overrides = {}


def _override_user() -> AuthenticatedUser:
    return AuthenticatedUser(user_id="user-1", auth_mode="test")


def test_ingest_sanitizes_filename_and_blocks_path_escape(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    uploads = tmp_path / "uploads"
    monkeypatch.chdir(tmp_path)
    captured: dict[str, object] = {}

    async def _fake_send(event):
        captured["pdf_path"] = event.data["pdf_path"]
        captured["user_id"] = event.data["user_id"]
        captured["source_id"] = event.data["source_id"]
        return ["evt-1"]

    app.dependency_overrides[resolve_authenticated_user] = _override_user
    monkeypatch.setattr(inngest_client, "send", _fake_send)
    client = TestClient(app)

    response = client.post(
        "/v1/ingest",
        files={"file": ("../evil.pdf", BytesIO(b"%PDF-1.4 test"), "application/pdf")},
    )
    assert response.status_code == 200
    assert captured["user_id"] == "user-1"
    assert str(captured["pdf_path"]).startswith(str(uploads.resolve()))
    assert ".." not in str(captured["pdf_path"])


@pytest.mark.anyio
async def test_unhandled_error_redacted_in_production():
    original_env = settings.app_env
    settings.app_env = "production"
    try:
        scope = {"type": "http", "method": "GET", "path": "/", "headers": []}
        request = Request(scope)
        response = await unhandled_exception_handler(request, RuntimeError("secret details"))
        assert response.status_code == 500
        body = response.body.decode("utf-8")
        assert "secret details" not in body
        assert "Internal server error" in body
    finally:
        settings.app_env = original_env
