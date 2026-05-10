"""Bearer-token authentication for the GovForge API (Phase 3.0 Stage A).

Token lifecycle
---------------

Generation (in `tokens` router or `bootstrap_admin.py`):
  1. `generate_token_secret()` — produces a 48-char URL-safe random string
     prefixed with `gfp_` (govforge personal). Total length 52 chars.
  2. `hash_token_secret(secret)` — SHA-256 hex digest, stored in
     `ApiToken.hashed_secret`. The plaintext is shown to the user once
     and never persisted.
  3. The first 8 chars after the prefix are duplicated into
     `ApiToken.prefix` so we can narrow the lookup by an indexed column
     before doing the constant-time hash comparison on a single row.

Verification (`RequireToken` dependency):
  1. Parse `Authorization: Bearer <secret>`.
  2. SELECT api_tokens WHERE prefix = first8(secret).
  3. For each candidate row, compare hash with `hmac.compare_digest`.
  4. Reject if revoked / expired / scope missing.
  5. Update `last_used_at` on success (best-effort, async-friendly).
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from govforge.api.deps import get_session
from govforge.core.enums import TokenScope
from govforge.core.models import ApiToken, User

TOKEN_PREFIX = "gfp_"
TOKEN_PREFIX_LEN = 8  # first 8 chars after `gfp_` are stored for indexed lookup
TOKEN_SECRET_LEN = 48  # 48 url-safe chars => ~288 bits of entropy


def generate_token_secret() -> str:
    """Return a fresh plaintext token. Caller must hash before persisting."""
    body = secrets.token_urlsafe(TOKEN_SECRET_LEN)[:TOKEN_SECRET_LEN]
    return f"{TOKEN_PREFIX}{body}"


def hash_token_secret(secret: str) -> str:
    """SHA-256 hex digest of the token. Length 64 chars."""
    return hashlib.sha256(secret.encode("ascii")).hexdigest()


def extract_prefix(secret: str) -> str:
    """Return the first 8 chars after `gfp_` for indexed lookup."""
    if not secret.startswith(TOKEN_PREFIX):
        return ""
    return secret[len(TOKEN_PREFIX) : len(TOKEN_PREFIX) + TOKEN_PREFIX_LEN]


_bearer_scheme = HTTPBearer(auto_error=False, description="Bearer api token")


def _resolve_token(
    session: Session, secret: str
) -> tuple[ApiToken, User] | None:
    """Look up an active ApiToken matching the bearer secret, plus its owner.

    Returns None if no match, or if the token is revoked / expired.
    """
    prefix = extract_prefix(secret)
    if not prefix:
        return None
    expected_hash = hash_token_secret(secret)
    candidates = session.scalars(
        select(ApiToken).where(ApiToken.prefix == prefix)
    ).all()
    for token in candidates:
        # constant-time compare on the hash
        if not hmac.compare_digest(token.hashed_secret, expected_hash):
            continue
        if not token.is_active:
            return None
        user = session.get(User, token.user_id)
        if user is None or not user.is_active:
            return None
        # bump last_used_at (best-effort; don't fail the request if commit hiccups)
        token.last_used_at = datetime.now(UTC)
        return token, user
    return None


class AuthContext:
    """Pre-built request principal: token + user. Returned by RequireToken."""

    __slots__ = ("token", "user")

    def __init__(self, token: ApiToken, user: User) -> None:
        self.token = token
        self.user = user


def RequireToken(
    *, scope: TokenScope | None = None
) -> Callable[..., AuthContext]:
    """FastAPI dependency factory: returns a callable that enforces a Bearer
    token AND an optional scope.

    Usage:
        @router.post("/tasks", ...)
        def create_task(
            ...,
            auth: Annotated[AuthContext, Depends(RequireToken(scope=TokenScope.TASKS_WRITE))],
            session: Annotated[Session, Depends(get_session)],
        ): ...
    """

    def _dependency(
        request: Request,
        credentials: Annotated[
            HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)
        ],
        session: Annotated[Session, Depends(get_session)],
    ) -> AuthContext:
        if credentials is None or not credentials.credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing bearer token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        resolved = _resolve_token(session, credentials.credentials)
        if resolved is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or revoked token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        token, user = resolved
        if scope is not None and not token.has_scope(scope):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Token missing required scope: {scope.value}",
            )
        # stash on request.state for audit logging downstream
        request.state.auth_token_id = token.id
        request.state.auth_user_id = user.id
        request.state.auth_agent_type = token.agent_type
        return AuthContext(token=token, user=user)

    return _dependency


__all__ = [
    "AuthContext",
    "RequireToken",
    "TOKEN_PREFIX",
    "extract_prefix",
    "generate_token_secret",
    "hash_token_secret",
]
