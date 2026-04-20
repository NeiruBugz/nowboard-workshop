from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlmodel.ext.asyncio.session import AsyncSession

from app.database import get_session
from app.main import app


def _invite_code_from_url(url: str) -> str:
    return url.rsplit("/", 1)[-1]


@pytest.fixture
async def make_client(engine: AsyncEngine):
    clients: list[AsyncClient] = []

    async def get_session_override() -> AsyncGenerator[AsyncSession, None]:
        async with AsyncSession(engine, expire_on_commit=False) as session:
            yield session

    app.dependency_overrides[get_session] = get_session_override

    async def _factory() -> AsyncClient:
        c = AsyncClient(transport=ASGITransport(app=app), base_url="http://t")
        clients.append(c)
        return c

    yield _factory

    for c in clients:
        await c.aclose()
    app.dependency_overrides.clear()


async def _sign_up(client: AsyncClient, email: str, name: str | None = None):
    resp = await client.post(
        "/api/auth/sign-up",
        json={"email": email, "password": "s3cretpass"},
    )
    assert resp.status_code == 201
    if name is not None:
        r = await client.patch("/api/users/me", json={"display_name": name})
        assert r.status_code == 200


async def test_full_team_flow(make_client):
    creator = await make_client()
    await _sign_up(creator, "creator@example.com", "Creator")

    resp = await creator.post("/api/teams", json={"name": "Alpha"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["team"]["name"] == "Alpha"
    alpha_invite_url = body["invite_url"]
    alpha_code = _invite_code_from_url(alpha_invite_url)

    cur = await creator.get("/api/teams/current")
    assert cur.status_code == 200
    assert cur.json()["team"]["name"] == "Alpha"

    # Creating a second team is rejected.
    second = await creator.post("/api/teams", json={"name": "AlphaTwo"})
    assert second.status_code == 409

    # Second user joins Alpha.
    joiner = await make_client()
    await _sign_up(joiner, "joiner@example.com", "Joiner")

    join1 = await joiner.post(
        "/api/teams/join", json={"invite_code": alpha_code}
    )
    assert join1.status_code == 200
    assert join1.json()["team"]["name"] == "Alpha"

    # Joining the same team again is a no-op success.
    join2 = await joiner.post(
        "/api/teams/join", json={"invite_code": alpha_code}
    )
    assert join2.status_code == 200

    # Bogus invite code -> 404.
    bogus = await joiner.post(
        "/api/teams/join", json={"invite_code": "does-not-exist"}
    )
    assert bogus.status_code == 404

    # Third user creates Beta, then tries to switch to Alpha.
    switcher = await make_client()
    await _sign_up(switcher, "switcher@example.com", "Switcher")
    beta = await switcher.post("/api/teams", json={"name": "Beta"})
    assert beta.status_code == 201

    needs_confirm = await switcher.post(
        "/api/teams/join",
        json={"invite_code": alpha_code, "confirm_switch": False},
    )
    assert needs_confirm.status_code == 409
    assert needs_confirm.json()["detail"]["needs_switch_confirm"] is True

    confirmed = await switcher.post(
        "/api/teams/join",
        json={"invite_code": alpha_code, "confirm_switch": True},
    )
    assert confirmed.status_code == 200
    assert confirmed.json()["team"]["name"] == "Alpha"

    me = await switcher.get("/api/users/me")
    assert me.status_code == 200
    assert me.json()["current_team"]["team"]["name"] == "Alpha"

    # Regenerate invite on creator's team.
    regen = await creator.post("/api/teams/current/invite/regenerate")
    assert regen.status_code == 200
    new_url = regen.json()["invite_url"]
    assert new_url != alpha_invite_url

    # Old code no longer works.
    other = await make_client()
    await _sign_up(other, "other@example.com", "Other")
    old = await other.post("/api/teams/join", json={"invite_code": alpha_code})
    assert old.status_code == 404
