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
from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from govforge.api.auth import (
    SESSION_COOKIE_NAME,
    SESSION_TTL_DAYS,
    create_session_row,
    encode_session_cookie,
    resolve_session,
)
from govforge.api.deps import get_session
from govforge.core.enums import AgentType, AuthProvider, TokenScope
from govforge.core.models import Account, DeviceCode, User

router = APIRouter(prefix="/auth", tags=["auth"])

# ---------------------------------------------------------------------------
# Configuration (env)
# ---------------------------------------------------------------------------

GITHUB_CLIENT_ID_ENV = "GITHUB_OAUTH_CLIENT_ID"
GITHUB_CLIENT_SECRET_ENV = "GITHUB_OAUTH_CLIENT_SECRET"

GOOGLE_CLIENT_ID_ENV = "GOOGLE_OAUTH_CLIENT_ID"
GOOGLE_CLIENT_SECRET_ENV = "GOOGLE_OAUTH_CLIENT_SECRET"

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


def _google_creds() -> tuple[str, str] | None:
    cid = os.environ.get(GOOGLE_CLIENT_ID_ENV)
    cs = os.environ.get(GOOGLE_CLIENT_SECRET_ENV)
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
# /auth/google/start
# ---------------------------------------------------------------------------


@router.get("/google/start", summary="Begin Google OAuth handshake")
def google_start(request: Request) -> RedirectResponse:
    creds = _google_creds()
    if creds is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Google OAuth not configured. Set "
                f"{GOOGLE_CLIENT_ID_ENV} and {GOOGLE_CLIENT_SECRET_ENV} "
                "in the backend environment."
            ),
        )
    client_id, _ = creds
    state = secrets.token_urlsafe(32)
    redirect_uri = _callback_url(request, "google")
    # `access_type=offline` is intentionally omitted — we don't refresh,
    # we issue our own cookie. `prompt=select_account` lets users pick a
    # Google account if multiple are logged in.
    authorize_url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&state={state}"
        "&response_type=code"
        "&scope=openid%20email%20profile"
        "&prompt=select_account"
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
# /auth/google/callback
# ---------------------------------------------------------------------------


@router.get("/google/callback", summary="Receive Google OAuth callback")
def google_callback(
    request: Request,
    code: Annotated[str, Query()],
    state: Annotated[str, Query()],
    db: Annotated[DBSession, Depends(get_session)],
) -> RedirectResponse:
    creds = _google_creds()
    if creds is None:
        raise HTTPException(503, "Google OAuth not configured")
    client_id, client_secret = creds

    state_cookie = request.cookies.get(OAUTH_STATE_COOKIE)
    if not state_cookie or not secrets.compare_digest(state_cookie, state):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OAuth state",
        )

    # Exchange the code for an access token.
    token_resp = httpx.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "redirect_uri": _callback_url(request, "google"),
            "grant_type": "authorization_code",
        },
        timeout=10.0,
    )
    if token_resp.status_code != 200:
        raise HTTPException(502, "Google token exchange failed")
    token_data = token_resp.json()
    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(401, f"Google denied access: {token_data.get('error', 'unknown')}")

    # Fetch profile via OpenID userinfo endpoint.
    user_resp = httpx.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10.0,
    )
    if user_resp.status_code != 200:
        raise HTTPException(502, "Failed to fetch Google profile")
    profile = user_resp.json()

    email = profile.get("email")
    if not email or not profile.get("email_verified", False):
        raise HTTPException(
            400, "Google account has no verified email — cannot sign in"
        )

    provider_user_id = str(profile["sub"])
    display_name = profile.get("name") or profile.get("given_name")
    avatar_url = profile.get("picture")

    # Upsert User + Account.
    account = db.scalar(
        select(Account).where(
            Account.provider == AuthProvider.GOOGLE,
            Account.provider_user_id == provider_user_id,
        )
    )
    if account is not None:
        user = db.get(User, account.user_id)
        if user is None:
            raise HTTPException(500, "Orphaned Account row")
        account.provider_email = email
        if display_name and not user.display_name:
            user.display_name = display_name
        if avatar_url and user.avatar_url != avatar_url:
            user.avatar_url = avatar_url
    else:
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(email=email, display_name=display_name, avatar_url=avatar_url)
            db.add(user)
            db.flush()
        elif not user.is_active:
            raise HTTPException(403, "User is deactivated")
        account = Account(
            user_id=user.id,
            provider=AuthProvider.GOOGLE,
            provider_user_id=provider_user_id,
            provider_email=email,
            provider_login=None,  # Google has no equivalent of GitHub's login handle
        )
        db.add(account)

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
# Magic link stub — kept until Resend is configured
# ---------------------------------------------------------------------------


@router.post("/magic/request", summary="Magic link email — not yet configured")
def magic_request() -> None:
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Magic link email not configured. Set RESEND_API_KEY in env to enable.",
    )


# ---------------------------------------------------------------------------
# Device code flow (RFC 8628 style — for `gf auth login --device`)
# ---------------------------------------------------------------------------
#
# Three endpoints:
#   POST /auth/device/code     (anon)   — CLI requests a code
#   POST /auth/device/poll     (anon)   — CLI polls until token issued
#   POST /auth/device/approve  (cookie) — browser approves a typed user code
#
# Storage: only the SHA-256 of `device_code` is persisted. `user_code` is
# stored in clear because it's a short human-typable string with a 10-min
# expiry and rate-limited typing as a natural backstop.
#
# The CLI flow:
#   1. POST /auth/device/code → user_code "ABCD-EFGH", device_code (secret), poll_url
#   2. CLI prints "Open <site>/device, type ABCD-EFGH"; polls /auth/device/poll
#   3. User opens browser, types code on /[lang]/device/, signs in if needed,
#      clicks "Authorize" — page POSTs /auth/device/approve with the cookie
#   4. Backend creates an ApiToken for the user, links it to the device row
#   5. Next CLI poll returns the ApiToken plaintext secret (one-time)
#   6. CLI saves it via `auth.Save(...)` — done


DEVICE_CODE_TTL_SECONDS = 600  # 10 min
DEVICE_CODE_POLL_INTERVAL = 5  # seconds
DEVICE_CODE_USER_CODE_LEN = 8  # ABCDEFGH → "ABCD-EFGH" for display
# Charset excludes O/0/I/1 to avoid handwriting/typing ambiguity.
DEVICE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
DEFAULT_DEVICE_SCOPES = [
    TokenScope.PROJECTS_READ,
    TokenScope.TASKS_READ,
    TokenScope.TASKS_WRITE,
    TokenScope.DECISIONS_READ,
    TokenScope.DECISIONS_WRITE,
    TokenScope.REVIEWS_READ,
    TokenScope.REVIEWS_WRITE,
    TokenScope.POLICIES_READ,
    TokenScope.EVENTS_READ,
    TokenScope.TOKENS_READ,
]


def _generate_device_secret() -> str:
    """High-entropy device_code (43 chars urlsafe)."""
    return secrets.token_urlsafe(32)


def _hash_device_code(secret: str) -> str:
    import hashlib

    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


def _generate_user_code() -> str:
    """8-char user_code, displayed as XXXX-XXXX."""
    raw = "".join(secrets.choice(DEVICE_CODE_ALPHABET) for _ in range(DEVICE_CODE_USER_CODE_LEN))
    return raw  # canonicalised uppercase, no separators in storage


def _normalize_user_code(value: str) -> str:
    """Strip whitespace and dashes, uppercase."""
    return value.strip().upper().replace("-", "").replace(" ", "")


def _format_user_code(code: str) -> str:
    """Display form: AAAA-BBBB."""
    if len(code) == DEVICE_CODE_USER_CODE_LEN:
        return f"{code[:4]}-{code[4:]}"
    return code


class DeviceCodeStartIn(BaseModel):
    label: str = "device-code-cli"
    agent_type: str = "other"


class DeviceCodeStartOut(BaseModel):
    device_code: str
    user_code: str           # display form: "ABCD-EFGH"
    verification_uri: str    # site URL the user should open
    expires_in: int          # seconds
    interval: int            # poll interval in seconds


class DeviceCodePollIn(BaseModel):
    device_code: str


class DeviceCodePollOut(BaseModel):
    # When status == "complete", `token` is the plaintext gfp_… secret.
    status: str              # "authorization_pending" | "complete" | "expired" | "denied"
    token: str | None = None
    token_id: str | None = None


class DeviceCodeApproveIn(BaseModel):
    user_code: str
    # Allow the browser-side form to override the scopes the CLI requested.
    scopes: list[str] | None = None


@router.post(
    "/device/code",
    response_model=DeviceCodeStartOut,
    summary="Start a device-code authorization (CLI → browser handoff)",
)
def device_code_start(
    body: DeviceCodeStartIn,
    db: Annotated[DBSession, Depends(get_session)],
) -> DeviceCodeStartOut:
    # Validate agent_type early so the eventual ApiToken doesn't fail on enum cast.
    try:
        agent_enum = AgentType(body.agent_type)
    except ValueError:
        raise HTTPException(400, f"unknown agent_type: {body.agent_type}") from None

    # Pick a user_code that isn't currently active (very low collision odds
    # at 32^8 ≈ 1e12, but the unique index would 500 otherwise).
    for _ in range(8):
        candidate = _generate_user_code()
        exists = db.scalar(
            select(DeviceCode).where(
                DeviceCode.user_code == candidate,
                DeviceCode.expires_at > _utcnow(),
                DeviceCode.revoked_at.is_(None),
            )
        )
        if exists is None:
            user_code = candidate
            break
    else:
        raise HTTPException(503, "Could not allocate a unique user_code")

    device_secret = _generate_device_secret()
    row = DeviceCode(
        device_code_hash=_hash_device_code(device_secret),
        user_code=user_code,
        requested_label=body.label or "device-code-cli",
        requested_agent_type=agent_enum,
        expires_at=_utcnow() + timedelta(seconds=DEVICE_CODE_TTL_SECONDS),
    )
    db.add(row)
    db.flush()

    return DeviceCodeStartOut(
        device_code=device_secret,
        user_code=_format_user_code(user_code),
        verification_uri=f"{DEFAULT_SITE_ORIGIN}/en/device/",
        expires_in=DEVICE_CODE_TTL_SECONDS,
        interval=DEVICE_CODE_POLL_INTERVAL,
    )


@router.post(
    "/device/poll",
    response_model=DeviceCodePollOut,
    summary="Poll a pending device-code authorization",
)
def device_code_poll(
    body: DeviceCodePollIn,
    db: Annotated[DBSession, Depends(get_session)],
) -> DeviceCodePollOut:
    row = db.scalar(
        select(DeviceCode).where(
            DeviceCode.device_code_hash == _hash_device_code(body.device_code)
        )
    )
    if row is None:
        # Don't leak whether the secret was ever issued.
        return DeviceCodePollOut(status="denied")
    if row.revoked_at is not None:
        return DeviceCodePollOut(status="denied")
    if row.is_expired:
        return DeviceCodePollOut(status="expired")
    if not row.is_approved or row.token_id is None:
        return DeviceCodePollOut(status="authorization_pending")

    # Approved: hand back the plaintext token secret (one-shot consume from
    # the in-process stash — see _stash_approval_secret below).
    secret = _consume_approval_secret(row)
    if secret is None:
        # Already polled once → secret was consumed. Treat as denied to
        # avoid double-issuing the same token.
        return DeviceCodePollOut(status="denied")
    return DeviceCodePollOut(
        status="complete",
        token=secret,
        token_id=str(row.token_id),
    )


@router.post(
    "/device/approve",
    status_code=status.HTTP_200_OK,
    summary="Approve a device-code request from a browser session",
)
def device_code_approve(
    body: DeviceCodeApproveIn,
    request: Request,
    db: Annotated[DBSession, Depends(get_session)],
) -> dict[str, str]:
    # Caller must be signed in via cookie.
    raw = request.cookies.get(SESSION_COOKIE_NAME)
    if not raw:
        raise HTTPException(401, "Sign in first")
    resolved = resolve_session(db, raw)
    if resolved is None:
        raise HTTPException(401, "Invalid or expired session")
    _, user = resolved

    normalized = _normalize_user_code(body.user_code)
    if len(normalized) != DEVICE_CODE_USER_CODE_LEN:
        raise HTTPException(400, "Code must be 8 characters")

    row = db.scalar(
        select(DeviceCode).where(DeviceCode.user_code == normalized)
    )
    if row is None:
        raise HTTPException(404, "Unknown code")
    if row.revoked_at is not None or row.is_expired:
        raise HTTPException(410, "Code expired")
    if row.is_approved:
        raise HTTPException(409, "Code already approved")

    # Build the scope set: page override wins; fall back to defaults.
    raw_scopes = body.scopes or [s.value for s in DEFAULT_DEVICE_SCOPES]
    try:
        scope_set = [TokenScope(s) for s in raw_scopes]
    except ValueError as e:
        raise HTTPException(400, f"unknown scope: {e}") from None

    from govforge.api.auth import (
        extract_prefix,
        generate_token_secret,
        hash_token_secret,
    )
    from govforge.core.models import ApiToken

    secret = generate_token_secret()
    token = ApiToken(
        user_id=user.id,
        label=row.requested_label,
        agent_type=row.requested_agent_type,
        prefix=extract_prefix(secret),
        hashed_secret=hash_token_secret(secret),
    )
    token.scopes = scope_set
    db.add(token)
    db.flush()

    row.user_id = user.id
    row.token_id = token.id
    row.approved_at = _utcnow()
    _stash_approval_secret(row, secret)
    return {"status": "approved", "label": row.requested_label}


def _utcnow() -> datetime:
    return datetime.now(UTC)


# In-process secret stash: maps DeviceCode.id → plaintext token secret.
# Survives only until the device polls (one-shot consume). NOT persisted
# to the DB so plaintext never lands in storage. Process-local — for a
# multi-replica deploy this would need Redis or a transient DB column;
# we're single-replica today.
_DEVICE_APPROVAL_SECRETS: dict[UUID, str] = {}


def _stash_approval_secret(row: DeviceCode, secret: str) -> None:
    _DEVICE_APPROVAL_SECRETS[row.id] = secret


def _consume_approval_secret(row: DeviceCode) -> str | None:
    return _DEVICE_APPROVAL_SECRETS.pop(row.id, None)


__all__ = ["router"]
