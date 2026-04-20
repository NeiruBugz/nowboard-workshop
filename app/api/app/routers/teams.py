from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import settings
from app.database import get_session
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas import (
    CreateTeamRequest,
    CreateTeamResponse,
    CurrentTeamOut,
    JoinTeamRequest,
    TeamOut,
)
from app.services import teams as teams_service

router = APIRouter(prefix="/api/teams", tags=["teams"])


def _invite_url(invite_code: str) -> str:
    return f"{settings.app_base_url}/join/{invite_code}"


@router.post(
    "",
    response_model=CreateTeamResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_team(
    payload: CreateTeamRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CreateTeamResponse:
    try:
        team = await teams_service.create_team(session, user, payload.name)
    except teams_service.TeamConflictError as exc:
        existing = exc.team
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "already_on_team",
                "current_team": TeamOut(
                    id=existing.id,
                    name=existing.name,
                    created_at=existing.created_at,
                ).model_dump(mode="json"),
            },
        ) from exc

    return CreateTeamResponse(
        team=TeamOut(id=team.id, name=team.name, created_at=team.created_at),
        invite_url=_invite_url(team.invite_code),
    )


@router.post(
    "/join",
    response_model=CurrentTeamOut,
    status_code=status.HTTP_200_OK,
)
async def join_team(
    payload: JoinTeamRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CurrentTeamOut:
    try:
        team, _switched = await teams_service.join_team_by_invite(
            session, user, payload.invite_code, payload.confirm_switch
        )
    except teams_service.TeamNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "invite_not_found"},
        ) from exc
    except teams_service.TeamSwitchConfirmRequired as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "needs_switch_confirm": True,
                "current_team": TeamOut(
                    id=exc.current_team.id,
                    name=exc.current_team.name,
                    created_at=exc.current_team.created_at,
                ).model_dump(mode="json"),
                "new_team": TeamOut(
                    id=exc.new_team.id,
                    name=exc.new_team.name,
                    created_at=exc.new_team.created_at,
                ).model_dump(mode="json"),
            },
        ) from exc

    return CurrentTeamOut(
        team=TeamOut(id=team.id, name=team.name, created_at=team.created_at),
        invite_url=_invite_url(team.invite_code),
    )


@router.get("/current", response_model=CurrentTeamOut)
async def current_team(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CurrentTeamOut:
    team = await teams_service.get_current_team(session, user.id)
    if team is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active team",
        )
    return CurrentTeamOut(
        team=TeamOut(id=team.id, name=team.name, created_at=team.created_at),
        invite_url=_invite_url(team.invite_code),
    )


@router.post("/current/invite/regenerate", response_model=CurrentTeamOut)
async def regenerate_current_invite(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CurrentTeamOut:
    team = await teams_service.get_current_team(session, user.id)
    if team is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "no_active_team"},
        )
    team = await teams_service.regenerate_invite(session, team)
    return CurrentTeamOut(
        team=TeamOut(id=team.id, name=team.name, created_at=team.created_at),
        invite_url=_invite_url(team.invite_code),
    )
