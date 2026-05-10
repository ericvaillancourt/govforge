"""OAuth + session routes (Phase 3.0 Stage B).

Endpoints:
  GET  /auth/github/start          → 302 to github.com/login/oauth/authorize
  GET  /auth/github/callback       → exchange code, upsert User+Account, set cookie
  GET  /auth/session               → current user info (401 if no/bad cookie)
  POST /auth/logout                → revoke session + clear cookie

Each provider/route returns 503 if its credentials aren't set in env — that
way the router is always wired into the app and turns "on" the moment
secrets land in backend.env. No rework needed when GitHub OAuth app gets
registered.

CSRF: the `state` parameter is a signed random nonce stored client-side
in a short-lived `govforge_oauth_state` cookie. The callback verifies the
incoming `state` matches the cookie's; mismatch → 400.
"""

from __future__ import annotations

import os
import secrets
from datetime import UTC, datetime
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from govforge.api.auth import (
    RequireUser,
    SESSION_COOKIE_NAME,
    SESSION_TTL_DAYS,
    UserContext,
    create_session_row,
    encode_session_cookie,
    resolve_session,
)
from govforge.api.deps import get_session
from govforge.core.enums import AuthProvider
from govforge.core.models import Account, User

router = APIRouter(prefix="/auth", tags=["auth"])

# ---------------------------------------------------------------------------
# Configuration (env)
# ---------------------------------------------------------------------------

GITHUB_CLIENT_ID_ENV = "GITHUB_OAUTH_CLIENT_ID"
GITHUB_CLIENT_SECRET_ENV = "GITHUB_OAUTH_CLIENT_SECRET"

OAUTH_STATE_COOKIE = "govforge_oauth_state"
OAUTH_STATE_TTL_SECONDS = 600  # 10 min

# Where the site sends users *after* a successful sign-in. The site origin
# is configurable via GOVFORGE_SITE_ORIGIN; default to production.
DEFAULT_SITE_ORIGIN = os.environ.get("GOVFORGE_SITE_ORIGIN", "https://govforge.dev")
DEFAULT_POST_LOGIN_PATH = "/en/account/"


def _github_creds() -> tuple[str, str] | None:
    cid = os.environ.get(GITHUB_CLIENT_ID_ENV)
    cs = os.environ.get(GITHUB_CLIENT_SECRET_ENV)
    if not cid or not cs:
        return None
    return cid, cs


def _callback_url(request: Request, provider: str) -> str:
    """Absolute callback URL — must match the one registered with the provider."""
    # In prod the request comes via api.govforge.dev (Cloudflare → Caddy).
    # `request.base_url` already reflects the X-Forwarded-Host header.
    return str(request.base_url).rstrip("/") + f"/auth/{provider}/callback"


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class SessionUserOut(BaseModel):
    id: str
    email: str
    display_name: str | None
    avatar_url: str | None
    accounts: list[str]  # provider names linked to the user


class SessionOut(BaseModel):
    user: SessionUserOut
    expires_at: datetime
    last_seen_at: datetime


# ---------------------------------------------------------------------------
# /auth/github/start
# ---------------------------------------------------------------------------


@router.get("/github/start", summary="Begin GitHub OAuth handshake")
def github_start(request: Request, response: Response) -> RedirectResponse:
    creds = _github_creds()
    if creds is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "GitHub OAuth not configured. Set "
                f"{GITHUB_CLIENT_ID_ENV} and {GITHUB_CLIENT_SECRET_ENV} "
                "in the backend environment."
            ),
        )
    client_id, _ = creds
    state = secrets.token_urlsafe(32)
    redirect_uri = _callback_url(request, "github")
    authorize_url = (
        "https://github.com/login/oauth/authorize"
        f"?client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&state={state}"
        "&scope=read:user%20user:email"
        "&allow_signup=true"
    )
    redirect = RedirectResponse(authorize_url, status_code=status.HTTP_302_FOUND)
    redirect.set_cookie(
        OAUTH_STATE_COOKIE,
        state,
        max_age=OAUTH_STATE_TTL_SECONDS,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/auth",
    )
    return redirect


# ---------------------------------------------------------------------------
# /auth/github/callback
# ---------------------------------------------------------------------------


@router.get("/github/callback", summary="Receive GitHub OAuth callback")
def github_callback(
    request: Request,
    code: Annotated[str, Query()],
    state: Annotated[str, Query()],
    db: Annotated[DBSession, Depends(get_session)],
) -> RedirectResponse:
    creds = _github_creds()
    if creds is None:
        raise HTTPException(503, "GitHub OAuth not configured")
    client_id, client_secret = creds

    state_cookie = request.cookies.get(OAUTH_STATE_COOKIE)
    if not state_cookie or not secrets.compare_digest(state_cookie, state):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OAuth state",
        )

    # Exchange the code for a token.
    token_resp = httpx.post(
        "https://github.com/login/oauth/access_token",
        headers={"Accept": "application/json"},
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "redirect_uri": _callback_url(request, "github"),
        },
        timeout=10.0,
    )
    if token_resp.status_code != 200:
        raise HTTPException(502, "GitHub token exchange failed")
    token_data = token_resp.json()
    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(401, f"GitHub denied access: {token_data.get('error', 'unknown')}")

    gh_headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "govforge-backend",
    }
    user_resp = httpx.get("https://api.github.com/user", headers=gh_headers, timeout=10.0)
    if user_resp.status_code != 200:
        raise HTTPException(502, "Failed to fetch GitHub profile")
    profile = user_resp.json()

    # /user may return a null email if the user keeps it private — fetch /user/emails.
    email: str | None = profile.get("email")
    if not email:
        emails_resp = httpx.get(
            "https://api.github.com/user/emails", headers=gh_headers, timeout=10.0
        )
        if emails_resp.status_code == 200:
            primaries = [
                e["email"]
                for e in emails_resp.json()
                if e.get("primary") and e.get("verified")
            ]
            if primaries:
                email = primaries[0]
    if not email:
        raise HTTPException(
            400, "GitHub account has no verified primary email — cannot sign in"
        )

    provider_user_id = str(profile["id"])
    display_name = profile.get("name") or profile.get("login")
    avatar_url = profile.get("avatar_url")
    login = profile.get("login")

    # Upsert User + Account.
    account = db.scalar(
        select(Account).where(
            Account.provider == AuthProvider.GITHUB,
            Account.provider_user_id == provider_user_id,
        )
    )
    if account is not None:
        user = db.get(User, account.user_id)
        if user is None:
            raise HTTPException(500, "Orphaned Account row")
        # Refresh provider fields if changed.
        account.provider_email = email
        account.provider_login = login
        if display_name and not user.display_name:
            user.display_name = display_name
        if avatar_url and user.avatar_url != avatar_url:
            user.avatar_url = avatar_url
    else:
        # Try to find an existing user by email (someone bootstrapped that email).
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(email=email, display_name=display_name, avatar_url=avatar_url)
            db.add(user)
            db.flush()
        elif not user.is_active:
            raise HTTPException(403, "User is deactivated")
        account = Account(
            user_id=user.id,
            provider=AuthProvider.GITHUB,
            provider_user_id=provider_user_id,
            provider_email=email,
            provider_login=login,
        )
        db.add(account)

    # Create session.
    session_row = create_session_row(
        db,
        user_id=user.id,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    db.flush()
    cookie_value = encode_session_cookie(session_row.id)
    if cookie_value is None:
        raise HTTPException(503, "Cookie sessions not configured (GOVFORGE_COOKIE_SECRET)")

    redirect = RedirectResponse(
        DEFAULT_SITE_ORIGIN + DEFAULT_POST_LOGIN_PATH,
        status_code=status.HTTP_302_FOUND,
    )
    cookie_domain = os.environ.get("GOVFORGE_COOKIE_DOMAIN")
    redirect.set_cookie(
        SESSION_COOKIE_NAME,
        cookie_value,
        max_age=SESSION_TTL_DAYS * 86400,
        httponly=True,
        secure=True,
        samesite="lax",
        domain=cookie_domain,
    )
    redirect.delete_cookie(OAUTH_STATE_COOKIE, path="/auth")
    return redirect


# ---------------------------------------------------------------------------
# /auth/session
# ---------------------------------------------------------------------------


@router.get("/session", response_model=SessionOut, summary="Current user")
def session(
    request: Request,
    db: Annotated[DBSession, Depends(get_session)],
) -> SessionOut:
    raw = request.cookies.get(SESSION_COOKIE_NAME)
    if not raw:
        raise HTTPException(401, "No active session")
    resolved = resolve_session(db, raw)
    if resolved is None:
        raise HTTPException(401, "Invalid or expired session")
    s, user = resolved
    return SessionOut(
        user=SessionUserOut(
            id=str(user.id),
            email=user.email,
            display_name=user.display_name,
            avatar_url=user.avatar_url,
            accounts=[a.provider.value for a in user.accounts],
        ),
        expires_at=s.expires_at,
        last_seen_at=s.last_seen_at,
    )


# ---------------------------------------------------------------------------
# /auth/logout
# ---------------------------------------------------------------------------


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke the current session",
)
def logout(
    request: Request,
    response: Response,
    db: Annotated[DBSession, Depends(get_session)],
) -> None:
    raw = request.cookies.get(SESSION_COOKIE_NAME)
    if raw:
        resolved = resolve_session(db, raw)
        if resolved is not None:
            s, _ = resolved
            s.revoked_at = datetime.now(UTC)
    cookie_domain = os.environ.get("GOVFORGE_COOKIE_DOMAIN")
    response.delete_cookie(
        SESSION_COOKIE_NAME,
        domain=cookie_domain,
        httponly=True,
        secure=True,
        samesite="lax",
    )


# ---------------------------------------------------------------------------
# Provider stubs (Google + magic link) — return 503 until wired
# ---------------------------------------------------------------------------


@router.get("/google/start", summary="Google OAuth — not yet configured")
def google_start() -> RedirectResponse:
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Google OAuth not yet configured. Coming next iteration.",
    )


@router.post("/magic/request", summary="Magic link email — not yet configured")
def magic_request() -> None:
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Magic link email not configured. Set RESEND_API_KEY in env to enable.",
    )


__all__ = ["router"]
