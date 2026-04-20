from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, StringConstraints
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import settings
from app.database import get_session
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas import CurrentTeamOut, MeResponse, TeamOut, UserOut
from app.services import teams as teams_service

router = APIRouter(prefix="/api/users", tags=["users"])


class UpdateMeRequest(BaseModel):
    display_name: Annotated[
        str,
        StringConstraints(min_length=1, max_length=40, strip_whitespace=True),
    ]


async def _build_current_team(
    session: AsyncSession, user: User
) -> CurrentTeamOut | None:
    team = await teams_service.get_current_team(session, user.id)
    if team is None:
        return None
    return CurrentTeamOut(
        team=TeamOut(id=team.id, name=team.name, created_at=team.created_at),
        invite_url=f"{settings.app_base_url}/join/{team.invite_code}",
    )


@router.get("/me", response_model=MeResponse)
async def read_me(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> MeResponse:
    current_team = await _build_current_team(session, user)
    return MeResponse(
        user=UserOut(id=user.id, email=user.email, display_name=user.display_name),
        current_team=current_team,
    )


@router.patch("/me", response_model=MeResponse)
async def update_me(
    payload: UpdateMeRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> MeResponse:
    user.display_name = payload.display_name
    session.add(user)
    await session.commit()
    await session.refresh(user)
    current_team = await _build_current_team(session, user)
    return MeResponse(
        user=UserOut(id=user.id, email=user.email, display_name=user.display_name),
        current_team=current_team,
    )
