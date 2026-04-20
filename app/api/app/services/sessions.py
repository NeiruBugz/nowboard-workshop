from __future__ import annotations

from time import time
from uuid import UUID

from fastapi import Request, Response
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.config import settings

COOKIE_NAME = "session"
_SALT = "nowboard-session"


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(settings.secret_key, salt=_SALT)


def _set_cookie(response: Response, user_id: UUID) -> None:
    payload = {"user_id": str(user_id), "iat": int(time())}
    token = _serializer().dumps(payload)
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=settings.session_ttl_seconds,
        httponly=True,
        samesite="lax",
        secure=False,
        path="/",
    )


def issue(response: Response, user_id: UUID) -> None:
    _set_cookie(response, user_id)


def refresh(response: Response, user_id: UUID) -> None:
    _set_cookie(response, user_id)


def read(request: Request) -> UUID | None:
    raw = request.cookies.get(COOKIE_NAME)
    if not raw:
        return None
    payload = _serializer().loads(raw, max_age=settings.session_ttl_seconds)
    user_id = payload.get("user_id")
    if not user_id:
        return None
    return UUID(user_id)


def read_safe(request: Request) -> UUID | None:
    try:
        return read(request)
    except (BadSignature, SignatureExpired):
        return None


def clear(response: Response) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value="",
        max_age=0,
        httponly=True,
        samesite="lax",
        secure=False,
        path="/",
    )
