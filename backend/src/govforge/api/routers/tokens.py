"""POST/GET/DELETE /tokens — manage API tokens for the authenticated user.

Stage A: only token-authenticated users can call these (cookie auth comes
in Stage B). To bootstrap the first admin token, run
`backend/scripts/bootstrap_admin.py` directly on the backend host.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from govforge.api.auth import (
    AuthContext,
    RequireToken,
    extract_prefix,
    generate_token_secret,
    hash_token_secret,
)
from govforge.api.deps import get_session
from govforge.api.schemas import ApiTokenCreateIn, ApiTokenCreateOut, ApiTokenOut
from govforge.core.enums import TokenScope
from govforge.core.models import ApiToken

router = APIRouter(prefix="/tokens", tags=["tokens"])


@router.post(
    "",
    response_model=ApiTokenCreateOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create an API token (returns the plaintext secret once)",
)
def create_token(
    body: ApiTokenCreateIn,
    auth: Annotated[AuthContext, Depends(RequireToken(scope=TokenScope.TOKENS_WRITE))],
    session: Annotated[Session, Depends(get_session)],
) -> ApiTokenCreateOut:
    secret = generate_token_secret()
    token = ApiToken(
        user_id=auth.user.id,
        label=body.label,
        agent_type=body.agent_type,
        prefix=extract_prefix(secret),
        hashed_secret=hash_token_secret(secret),
    )
    token.scopes = list(body.scopes)
    if body.expires_in_days is not None:
        token.expires_at = datetime.now(UTC) + timedelta(days=body.expires_in_days)
    session.add(token)
    session.flush()
    return ApiTokenCreateOut(token=ApiTokenOut.model_validate(token), secret=secret)


@router.get("", response_model=list[ApiTokenOut], summary="List your API tokens")
def list_tokens(
    auth: Annotated[AuthContext, Depends(RequireToken(scope=TokenScope.TOKENS_READ))],
    session: Annotated[Session, Depends(get_session)],
) -> list[ApiTokenOut]:
    tokens = session.scalars(
        select(ApiToken)
        .where(ApiToken.user_id == auth.user.id)
        .order_by(ApiToken.created_at.desc())
    ).all()
    return [ApiTokenOut.model_validate(t) for t in tokens]


@router.delete(
    "/{token_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke an API token",
)
def revoke_token(
    token_id: UUID,
    auth: Annotated[AuthContext, Depends(RequireToken(scope=TokenScope.TOKENS_WRITE))],
    session: Annotated[Session, Depends(get_session)],
) -> None:
    token = session.get(ApiToken, token_id)
    if token is None or token.user_id != auth.user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Token not found")
    if token.revoked_at is not None:
        return  # idempotent
    token.revoked_at = datetime.now(UTC)


__all__ = ["router"]
