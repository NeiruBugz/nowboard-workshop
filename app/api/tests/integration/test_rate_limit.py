from httpx import AsyncClient


async def test_sign_in_rate_limited_after_5_attempts(client: AsyncClient):
    # The rate-limit bucket is keyed by client IP and the limit is 5 per window
    # across all /api/auth calls. Fire 6 sign-ins from the same client; the
    # 6th should be rejected with 429.
    statuses: list[int] = []
    for _ in range(6):
        r = await client.post(
            "/api/auth/sign-in",
            json={"email": "nobody@example.com", "password": "wrongwrong"},
        )
        statuses.append(r.status_code)

    assert statuses[:5] == [401] * 5
    assert statuses[5] == 429
