import time
from uuid import uuid4

from fastapi import Request, Response
from itsdangerous import URLSafeTimedSerializer

from app.config import settings
from app.services import sessions


def _request_with_cookie(name: str, value: str) -> Request:
    cookie_header = f"{name}={value}".encode()
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": [(b"cookie", cookie_header)],
    }
    return Request(scope)


def _request_without_cookie() -> Request:
    scope = {"type": "http", "method": "GET", "path": "/", "headers": []}
    return Request(scope)


def _extract_session_cookie(response: Response) -> str:
    for key, value in response.raw_headers:
        if key == b"set-cookie":
            header = value.decode()
            if header.startswith(f"{sessions.COOKIE_NAME}="):
                return header.split(";", 1)[0].split("=", 1)[1]
    raise AssertionError("session cookie not set")


def test_issue_sets_session_cookie():
    response = Response()
    uid = uuid4()
    sessions.issue(response, uid)

    token = _extract_session_cookie(response)
    assert token != ""

    request = _request_with_cookie(sessions.COOKIE_NAME, token)
    assert sessions.read_safe(request) == uid


def test_read_safe_returns_none_for_tampered_cookie():
    response = Response()
    sessions.issue(response, uuid4())
    token = _extract_session_cookie(response)

    tampered = token[:-2] + ("AA" if not token.endswith("AA") else "BB")
    request = _request_with_cookie(sessions.COOKIE_NAME, tampered)
    assert sessions.read_safe(request) is None


def test_read_safe_returns_none_for_missing_cookie():
    request = _request_without_cookie()
    assert sessions.read_safe(request) is None


def test_read_safe_returns_none_for_expired_cookie(monkeypatch):
    serializer = URLSafeTimedSerializer(settings.secret_key, salt="nowboard-session")
    uid = uuid4()
    past = int(time.time()) - (settings.session_ttl_seconds + 3600)

    class _FakeTimeSigner:
        pass

    # Manually craft an expired token by signing with a patched time source.
    real_time = time.time
    monkeypatch.setattr(time, "time", lambda: past)
    try:
        expired_token = serializer.dumps({"user_id": str(uid), "iat": past})
    finally:
        monkeypatch.setattr(time, "time", real_time)

    request = _request_with_cookie(sessions.COOKIE_NAME, expired_token)
    assert sessions.read_safe(request) is None


def test_clear_sets_max_age_zero():
    response = Response()
    sessions.clear(response)

    found = False
    for key, value in response.raw_headers:
        if key == b"set-cookie" and value.decode().startswith(
            f"{sessions.COOKIE_NAME}="
        ):
            assert "Max-Age=0" in value.decode()
            found = True
    assert found, "session clear did not set a cookie header"
