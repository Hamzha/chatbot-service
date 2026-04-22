from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated, Any

import jwt
from fastapi import Header, HTTPException
from jwt import InvalidTokenError

from app.config import settings


@dataclass(frozen=True)
class AuthenticatedUser:
    user_id: str
    auth_mode: str


def _extract_bearer_token(value: str | None) -> str | None:
    if not value:
        return None
    scheme, _, token = value.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    return token.strip()


def _verify_bearer_user_id(token: str) -> str:
    if not settings.auth_jwt_secret.strip():
        raise HTTPException(status_code=401, detail="Bearer authentication is not configured")
    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            settings.auth_jwt_secret,
            algorithms=["HS256"],
            options={"require": ["sub"]},
        )
    except InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Invalid bearer token") from exc
    user_id = str(payload.get("sub", "")).strip()
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid bearer token payload")
    return user_id


def resolve_authenticated_user(
    authorization: Annotated[str | None, Header()] = None,
    x_user_id: Annotated[str | None, Header()] = None,
    x_api_key: Annotated[str | None, Header()] = None,
) -> AuthenticatedUser:
    token = _extract_bearer_token(authorization)
    if token:
        return AuthenticatedUser(user_id=_verify_bearer_user_id(token), auth_mode="bearer")

    user_id = (x_user_id or "").strip()
    if user_id and settings.service_api_key.strip():
        if x_api_key == settings.service_api_key:
            return AuthenticatedUser(user_id=user_id, auth_mode="service_api_key")

    if user_id and not settings.is_production:
        # Development fallback for local tooling when auth is not yet wired.
        return AuthenticatedUser(user_id=user_id, auth_mode="dev_header")

    raise HTTPException(status_code=401, detail="Unauthorized")
