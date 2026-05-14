"""GET /me — return the authenticated principal + the current token's scopes.

This is the introspection endpoint VS Code / the cockpit call after sign-in
to know which write actions to surface. It never returns scopes from any
token other than the one used to authenticate the request — that would be
a confused-deputy bug.

For cookie-authenticated callers (cockpit users), `token` is `null` and
`scopes` is the empty list, since cookie sessions don't carry token scopes.
Such callers should not gate write UI on this endpoint.
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from govforge.api.auth import Principal, RequirePrincipal
from govforge.core.enums import TokenScope

router = APIRouter(prefix="/me", tags=["me"])


class UserBrief(BaseModel):
    """Minimal user shape exposed by /me. No PII beyond what the user typed."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    display_name: str | None


class TokenBrief(BaseModel):
    """Minimal token shape exposed by /me. Only the secret-free fields."""

    id: UUID
    label: str
    scopes: list[TokenScope] = Field(
        description="Resolved list from scopes_csv. Use this to gate write UI.",
    )


class MeOut(BaseModel):
    user: UserBrief
    token: TokenBrief | None = Field(
        default=None,
        description=(
            "The token used to authenticate THIS request, or null if the "
            "caller is cookie-authenticated. Never contains another token's "
            "scopes."
        ),
    )


@router.get(
    "",
    response_model=MeOut,
    summary="Introspect the current principal and the calling token's scopes",
)
def get_me(
    auth: Annotated[Principal, Depends(RequirePrincipal())],
) -> MeOut:
    user = UserBrief.model_validate(auth.user)
    token = (
        TokenBrief(id=auth.token.id, label=auth.token.label, scopes=auth.token.scopes)
        if auth.token is not None
        else None
    )
    return MeOut(user=user, token=token)


__all__ = ["router"]
