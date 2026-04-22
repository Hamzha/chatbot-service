from __future__ import annotations

import jwt
import pytest
from fastapi import HTTPException

from app.auth import resolve_authenticated_user
from app.config import settings


@pytest.fixture(autouse=True)
def restore_auth_settings():
    original_secret = settings.auth_jwt_secret
    original_service_key = settings.service_api_key
    original_env = settings.app_env
    try:
        yield
    finally:
        settings.auth_jwt_secret = original_secret
        settings.service_api_key = original_service_key
        settings.app_env = original_env


def test_resolve_user_from_bearer_token():
    settings.auth_jwt_secret = "secret-1"
    token = jwt.encode({"sub": "user-123"}, settings.auth_jwt_secret, algorithm="HS256")
    user = resolve_authenticated_user(authorization=f"Bearer {token}")
    assert user.user_id == "user-123"
    assert user.auth_mode == "bearer"


def test_resolve_user_from_service_key():
    settings.app_env = "production"
    settings.service_api_key = "svc-123"
    user = resolve_authenticated_user(x_user_id="user-9", x_api_key="svc-123")
    assert user.user_id == "user-9"
    assert user.auth_mode == "service_api_key"


def test_reject_missing_auth_in_production():
    settings.app_env = "production"
    settings.auth_jwt_secret = ""
    settings.service_api_key = ""
    with pytest.raises(HTTPException) as err:
        resolve_authenticated_user(x_user_id="user-1")
    assert err.value.status_code == 401
