from httpx import AsyncClient


async def test_sign_up_happy_path(client: AsyncClient):
    resp = await client.post(
        "/api/auth/sign-up",
        json={"email": "alice@example.com", "password": "s3cretpass"},
    )
    assert resp.status_code == 201
    assert "session=" in resp.headers.get("set-cookie", "")
    body = resp.json()
    assert body["user"]["email"] == "alice@example.com"
    assert body["needs_display_name"] is True
    assert body["current_team"] is None


async def test_duplicate_sign_up_returns_409(client: AsyncClient):
    payload = {"email": "dup@example.com", "password": "s3cretpass"}
    first = await client.post("/api/auth/sign-up", json=payload)
    assert first.status_code == 201

    # Wipe session cookie so the second request is a fresh sign-up attempt.
    client.cookies.clear()
    second = await client.post("/api/auth/sign-up", json=payload)
    assert second.status_code == 409
    assert second.json()["detail"]["error"] == "email_taken"


async def test_sign_in_correct_password(client: AsyncClient):
    await client.post(
        "/api/auth/sign-up",
        json={"email": "bob@example.com", "password": "s3cretpass"},
    )
    client.cookies.clear()
    resp = await client.post(
        "/api/auth/sign-in",
        json={"email": "bob@example.com", "password": "s3cretpass"},
    )
    assert resp.status_code == 200
    assert "session=" in resp.headers.get("set-cookie", "")


async def test_sign_in_wrong_password(client: AsyncClient):
    await client.post(
        "/api/auth/sign-up",
        json={"email": "carol@example.com", "password": "s3cretpass"},
    )
    client.cookies.clear()
    resp = await client.post(
        "/api/auth/sign-in",
        json={"email": "carol@example.com", "password": "wrongpass"},
    )
    assert resp.status_code == 401
    assert resp.json()["detail"]["error"] == "invalid_credentials"


async def test_sign_in_unknown_email(client: AsyncClient):
    resp = await client.post(
        "/api/auth/sign-in",
        json={"email": "nobody@example.com", "password": "whatever1"},
    )
    assert resp.status_code == 401
    assert resp.json()["detail"]["error"] == "invalid_credentials"


async def test_sign_out_clears_cookie_and_me_becomes_401(client: AsyncClient):
    await client.post(
        "/api/auth/sign-up",
        json={"email": "dave@example.com", "password": "s3cretpass"},
    )
    me = await client.get("/api/users/me")
    assert me.status_code == 200

    out = await client.post("/api/auth/sign-out")
    assert out.status_code == 204

    # The sign-out response resets the cookie value/max-age; emulate browser
    # handling by clearing cookies on our client before checking /me.
    client.cookies.clear()
    me2 = await client.get("/api/users/me")
    assert me2.status_code == 401


async def test_display_name_validation(client: AsyncClient):
    await client.post(
        "/api/auth/sign-up",
        json={"email": "eve@example.com", "password": "s3cretpass"},
    )

    empty = await client.patch("/api/users/me", json={"display_name": ""})
    assert empty.status_code == 422

    too_long = await client.patch(
        "/api/users/me", json={"display_name": "x" * 41}
    )
    assert too_long.status_code == 422

    ok = await client.patch("/api/users/me", json={"display_name": "Eve"})
    assert ok.status_code == 200
    assert ok.json()["user"]["display_name"] == "Eve"
