from __future__ import annotations

from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, EmailStr, StringConstraints


class UserOut(BaseModel):
    id: UUID
    email: EmailStr
    display_name: str | None = None


class TeamOut(BaseModel):
    id: UUID
    name: str
    created_at: datetime


class CurrentTeamOut(BaseModel):
    team: TeamOut
    invite_url: str


Password = Annotated[str, StringConstraints(min_length=8, max_length=128)]


class SignUpRequest(BaseModel):
    email: EmailStr
    password: Password


class SignInRequest(BaseModel):
    email: EmailStr
    password: Password


class AuthResponse(BaseModel):
    user: UserOut
    needs_display_name: bool
    current_team: CurrentTeamOut | None = None


class MeResponse(BaseModel):
    user: UserOut
    current_team: CurrentTeamOut | None = None


TeamName = Annotated[
    str,
    StringConstraints(min_length=2, max_length=40, strip_whitespace=True),
]


class CreateTeamRequest(BaseModel):
    name: TeamName


class CreateTeamResponse(BaseModel):
    team: TeamOut
    invite_url: str


class JoinTeamRequest(BaseModel):
    invite_code: str
    confirm_switch: bool = False


class SwitchConfirmError(BaseModel):
    needs_switch_confirm: bool = True
    current_team: TeamOut
    new_team: TeamOut
