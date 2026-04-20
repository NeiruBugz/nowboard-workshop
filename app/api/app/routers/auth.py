from __future__ import annotations

import asyncio
import time
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from structlog import get_logger

from app.config import settings
from app.database import get_session
from app.models.user import User
from app.schemas import (
    AuthResponse,
    CurrentTeamOut,
    SignInRequest,
    SignUpRequest,
    TeamOut,
    UserOut,
)
from app.services import sessions
from app.services import teams as teams_service
from app.services.passwords import hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = get_logger(__name__)

_attempts: dict[str, deque[float]] = defaultdict(deque)
_attempts_lock = asyncio.Lock()


async def _check_rate_limit(request: Request) -> None:
    client_host = request.client.host if request.client else "unknown"
    now = time.monotonic()
    window = settings.rate_limit_window_seconds
    cutoff = now - window

    async with _attempts_lock:
        bucket = _attempts[client_host]
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= settings.rate_limit_max:
            logger.warning("rate_limited", ip=client_host)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"error": "rate_limited"},
            )
        bucket.append(now)


async def _build_auth_response(
    session: AsyncSession, user: User, response: Response
) -> AuthResponse:
    sessions.issue(response, user.id)
    team = await teams_service.get_current_team(session, user.id)
    current_team = (
        CurrentTeamOut(
            team=TeamOut(id=team.id, name=team.name, created_at=team.created_at),
            invite_url=f"{settings.app_base_url}/join/{team.invite_code}",
        )
        if team is not None
        else None
    )
    return AuthResponse(
        user=UserOut(id=user.id, email=user.email, display_name=user.display_name),
        needs_display_name=user.display_name is None,
        current_team=current_team,
    )


@router.post(
    "/sign-up", response_model=AuthResponse, status_code=status.HTTP_201_CREATED
)
async def sign_up(
    payload: SignUpRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> AuthResponse:
    await _check_rate_limit(request)
    email = payload.email.lower()

    existing = await session.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "email_taken"},
        )

    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        display_name=None,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    return await _build_auth_response(session, user, response)


@router.post("/sign-in", response_model=AuthResponse)
async def sign_in(
    payload: SignInRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> AuthResponse:
    await _check_rate_limit(request)
    email = payload.email.lower()

    result = await session.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "invalid_credentials"},
        )

    return await _build_auth_response(session, user, response)


@router.post("/sign-out", status_code=status.HTTP_204_NO_CONTENT)
async def sign_out() -> Response:
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    sessions.clear(response)
    return response
