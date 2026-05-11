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
import os
import secrets
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from govforge.api.deps import get_session
from govforge.core.enums import TokenScope
from govforge.core.models import ApiToken, Session, User

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
    session: DBSession, secret: str
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
            session: Annotated[DBSession, Depends(get_session)],
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


# ---------------------------------------------------------------------------
# Cookie sessions (Phase 3.0 Stage B)
# ---------------------------------------------------------------------------
#
# Cookie format: `<session_id>.<signature>` where signature is
# HMAC-SHA256(session_id_str.encode(), GOVFORGE_COOKIE_SECRET.encode()) hex.
# Verification rejects bad signatures BEFORE touching the DB.
#
# Configuration:
#   GOVFORGE_COOKIE_SECRET      — required for cookie auth to work (32+ bytes random)
#   GOVFORGE_COOKIE_NAME        — default `govforge_session`
#   GOVFORGE_COOKIE_DOMAIN      — default unset (host-only); use `.govforge.dev`
#                                  in prod so the cookie covers api.govforge.dev too
#   GOVFORGE_SESSION_TTL_DAYS   — default 30

SESSION_COOKIE_NAME = os.environ.get("GOVFORGE_COOKIE_NAME", "govforge_session")
SESSION_TTL_DAYS = int(os.environ.get("GOVFORGE_SESSION_TTL_DAYS", "30"))


def _cookie_secret() -> str | None:
    """The signing secret. Falsy if not configured — callers must 503."""
    val = os.environ.get("GOVFORGE_COOKIE_SECRET")
    return val if val else None


def _sign_session_id(session_id: UUID, secret: str) -> str:
    sig = hmac.new(
        secret.encode("utf-8"), str(session_id).encode("ascii"), hashlib.sha256
    ).hexdigest()
    return f"{session_id}.{sig}"


def _verify_session_cookie(raw: str, secret: str) -> UUID | None:
    """Return the session_id if signature checks out, else None."""
    if "." not in raw:
        return None
    sid_str, sig = raw.rsplit(".", 1)
    expected_sig = hmac.new(
        secret.encode("utf-8"), sid_str.encode("ascii"), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(sig, expected_sig):
        return None
    try:
        return UUID(sid_str)
    except ValueError:
        return None


def create_session_row(
    db: DBSession,
    *,
    user_id: UUID,
    user_agent: str | None = None,
    ip_address: str | None = None,
    ttl_days: int | None = None,
) -> Session:
    """Insert a Session row with default TTL. Returns the row (caller flushes/commits)."""
    now = datetime.now(UTC)
    ttl = ttl_days if ttl_days is not None else SESSION_TTL_DAYS
    s = Session(
        user_id=user_id,
        user_agent=user_agent[:512] if user_agent else None,
        ip_address=ip_address[:45] if ip_address else None,
        created_at=now,
        last_seen_at=now,
        expires_at=now + timedelta(days=ttl),
    )
    db.add(s)
    return s


def encode_session_cookie(session_id: UUID) -> str | None:
    """Returns the value to set on the `govforge_session` cookie."""
    secret = _cookie_secret()
    if secret is None:
        return None
    return _sign_session_id(session_id, secret)


def resolve_session(db: DBSession, raw_cookie: str) -> tuple[Session, User] | None:
    """Verify signature → DB lookup. Returns (session, user) iff active."""
    secret = _cookie_secret()
    if secret is None:
        return None
    sid = _verify_session_cookie(raw_cookie, secret)
    if sid is None:
        return None
    s = db.get(Session, sid)
    if s is None or not s.is_active:
        return None
    user = db.get(User, s.user_id)
    if user is None or not user.is_active:
        return None
    # Touch last_seen_at (best-effort).
    s.last_seen_at = datetime.now(UTC)
    return s, user


class UserContext:
    """Pre-built request principal for cookie-authenticated users."""

    __slots__ = ("session", "user")

    def __init__(self, session: Session, user: User) -> None:
        self.session = session
        self.user = user


def RequireUser() -> Callable[..., UserContext]:
    """FastAPI dependency: enforce a valid cookie session."""

    def _dependency(
        request: Request,
        db: Annotated[DBSession, Depends(get_session)],
    ) -> UserContext:
        if _cookie_secret() is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Cookie sessions not configured on this server",
            )
        raw = request.cookies.get(SESSION_COOKIE_NAME)
        if not raw:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing session cookie",
            )
        resolved = resolve_session(db, raw)
        if resolved is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired session",
            )
        session, user = resolved
        request.state.auth_user_id = user.id
        request.state.auth_session_id = session.id
        return UserContext(session=session, user=user)

    return _dependency


class Principal:
    """Pre-built request principal accepting EITHER Bearer or cookie.

    Used by endpoints that should work for both API clients (Bearer) and
    the browser sign-in UX (cookie). `.user` is always set; `.token` is set
    only when authenticated via Bearer (None when via cookie).
    """

    __slots__ = ("session", "token", "user")

    def __init__(
        self,
        user: User,
        token: ApiToken | None = None,
        session: Session | None = None,
    ) -> None:
        self.user = user
        self.token = token
        self.session = session

    @property
    def auth_kind(self) -> str:
        return "token" if self.token is not None else "cookie"


def RequirePrincipal(
    *, scope: TokenScope | None = None
) -> Callable[..., Principal]:
    """Accept EITHER a Bearer token (with optional scope) OR a cookie session.

    Resolution order:
      1. If `Authorization: Bearer …` is present, use the token path (with scope).
      2. Else if a session cookie is present, use the cookie path (scope ignored —
         the logged-in user has implicit access to their own resources).
      3. Else → 401.
    """

    def _dependency(
        request: Request,
        credentials: Annotated[
            HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)
        ],
        db: Annotated[Session, Depends(get_session)],
    ) -> Principal:
        # Bearer path
        if credentials is not None and credentials.credentials:
            resolved = _resolve_token(db, credentials.credentials)
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
            request.state.auth_token_id = token.id
            request.state.auth_user_id = user.id
            request.state.auth_agent_type = token.agent_type
            return Principal(user=user, token=token)

        # Cookie path
        if _cookie_secret() is not None:
            raw = request.cookies.get(SESSION_COOKIE_NAME)
            if raw:
                resolved_cookie = resolve_session(db, raw)
                if resolved_cookie is not None:
                    session_row, user = resolved_cookie
                    request.state.auth_user_id = user.id
                    request.state.auth_session_id = session_row.id
                    return Principal(user=user, session=session_row)

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token or session cookie",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return _dependency


__all__ = [
    "SESSION_COOKIE_NAME",
    "SESSION_TTL_DAYS",
    "TOKEN_PREFIX",
    "AuthContext",
    "Principal",
    "RequirePrincipal",
    "RequireToken",
    "RequireUser",
    "UserContext",
    "create_session_row",
    "encode_session_cookie",
    "extract_prefix",
    "generate_token_secret",
    "hash_token_secret",
    "resolve_session",
]
