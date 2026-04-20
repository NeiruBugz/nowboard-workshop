from __future__ import annotations

import secrets
from datetime import UTC, datetime

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.membership import TeamMembership
from app.models.team import Team
from app.models.user import User


class TeamConflictError(Exception):
    """Raised when the user already belongs to a team."""

    def __init__(self, team: Team) -> None:
        super().__init__("User already has an active team membership")
        self.team = team


class TeamNotFoundError(Exception):
    """Raised when an invite code does not match any team."""


class TeamSwitchConfirmRequired(Exception):
    """Raised when joining a different team requires explicit confirmation."""

    def __init__(self, current_team: Team, new_team: Team) -> None:
        super().__init__("Team switch confirmation required")
        self.current_team = current_team
        self.new_team = new_team


def generate_invite_code() -> str:
    return secrets.token_urlsafe(12)[:16]


async def get_active_membership(
    session: AsyncSession, user_id
) -> TeamMembership | None:
    result = await session.execute(
        select(TeamMembership).where(
            TeamMembership.user_id == user_id,
            TeamMembership.left_at.is_(None),  # type: ignore[union-attr]
        )
    )
    return result.scalar_one_or_none()


async def get_current_team(session: AsyncSession, user_id) -> Team | None:
    result = await session.execute(
        select(Team)
        .join(TeamMembership, TeamMembership.team_id == Team.id)
        .where(
            TeamMembership.user_id == user_id,
            TeamMembership.left_at.is_(None),  # type: ignore[union-attr]
        )
    )
    return result.scalar_one_or_none()


async def _get_team_by_id(session: AsyncSession, team_id) -> Team | None:
    result = await session.execute(select(Team).where(Team.id == team_id))
    return result.scalar_one_or_none()


async def create_team(session: AsyncSession, user: User, name: str) -> Team:
    existing = await get_active_membership(session, user.id)
    if existing is not None:
        team = await _get_team_by_id(session, existing.team_id)
        raise TeamConflictError(team)  # type: ignore[arg-type]

    team = Team(
        name=name,
        invite_code=generate_invite_code(),
        created_by_user_id=user.id,
    )
    session.add(team)
    await session.flush()

    membership = TeamMembership(user_id=user.id, team_id=team.id)
    session.add(membership)

    await session.commit()
    await session.refresh(team)
    return team


async def regenerate_invite(session: AsyncSession, team: Team) -> Team:
    team.invite_code = generate_invite_code()
    session.add(team)
    await session.commit()
    await session.refresh(team)
    return team


async def join_team_by_invite(
    session: AsyncSession,
    user: User,
    invite_code: str,
    confirm_switch: bool,
) -> tuple[Team, bool]:
    result = await session.execute(
        select(Team).where(Team.invite_code == invite_code)
    )
    team = result.scalar_one_or_none()
    if team is None:
        raise TeamNotFoundError(invite_code)

    active = await get_active_membership(session, user.id)
    if active is None:
        membership = TeamMembership(user_id=user.id, team_id=team.id)
        session.add(membership)
        await session.commit()
        return team, False

    if active.team_id == team.id:
        return team, False

    current_team = await _get_team_by_id(session, active.team_id)
    if not confirm_switch:
        raise TeamSwitchConfirmRequired(current_team, team)  # type: ignore[arg-type]

    active.left_at = datetime.now(UTC)
    session.add(active)
    new_membership = TeamMembership(user_id=user.id, team_id=team.id)
    session.add(new_membership)
    await session.commit()
    return team, True
