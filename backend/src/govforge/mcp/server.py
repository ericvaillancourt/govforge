"""FastMCP server factory + stdio entry point.

`build_server(session_factory)` returns a configured `FastMCP` instance with
the phase-1 tools, 5 resources, and 3 prompts registered. The set of tools
exposed is filtered by the scopes of the API token resolved from the
environment (`GOVFORGE_API_TOKEN`) or `~/.config/govforge/auth.toml`. When
no token is configured, every tool is registered (back-compat).

Run as ``python -m govforge.mcp.server`` (uses the database at
``$GOVFORGE_DB`` or `.govforge/govforge.db`).
"""

from __future__ import annotations

import hmac
import os
from pathlib import Path

from fastmcp import FastMCP
from sqlalchemy import select

from govforge.api.auth import extract_prefix, hash_token_secret
from govforge.core.enums import TokenScope
from govforge.core.models import ApiToken, User
from govforge.db.session import make_engine, make_session_factory
from govforge.mcp.context import ServerContext, SessionFactory
from govforge.mcp.prompts import register_prompts
from govforge.mcp.resources import register_resources
from govforge.mcp.tools import register_tools


def build_server(
    session_factory: SessionFactory,
    *,
    name: str = "govforge",
    scopes: set[TokenScope] | None = None,
) -> FastMCP:
    """Construct a FastMCP server with the phase-1 capabilities registered.

    `scopes=None` registers every tool (back-compat for unauth'd self-hosted
    use). Otherwise tools are filtered per `TOOL_SCOPES` in `mcp.tools`.
    """
    server: FastMCP = FastMCP(name)
    ctx = ServerContext(session_factory=session_factory)
    register_tools(server, ctx, scopes=scopes)
    register_resources(server, ctx)
    register_prompts(server)
    return server


def _read_auth_toml_token() -> str | None:
    """Mirror the Go CLI's resolution order for the user-wide auth file:
    `$XDG_CONFIG_HOME/govforge/auth.toml` → `~/.config/govforge/auth.toml`.
    Per-project `.govforge/auth.toml` is intentionally not consulted here —
    MCP is wired up at the user level, not per repo.
    """
    cfg = os.environ.get("XDG_CONFIG_HOME") or str(Path.home() / ".config")
    path = Path(cfg) / "govforge" / "auth.toml"
    if not path.exists():
        return None
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        key, sep, val = line.partition("=")
        if not sep or key.strip() != "token":
            continue
        return val.strip().strip("'\"") or None
    return None


def resolve_scopes(session_factory: SessionFactory) -> set[TokenScope] | None:
    """Look up the API token and return its scopes (or None for back-compat).

    Returns:
      - `None` — no token configured; expose every tool (legacy default).
      - `set()` — token configured but invalid/revoked; expose nothing.
      - `set(scopes)` — token resolved; expose tools covered by these scopes
        (`TokenScope.ADMIN` exposes everything).
    """
    secret = os.environ.get("GOVFORGE_API_TOKEN") or _read_auth_toml_token()
    if not secret:
        return None
    prefix = extract_prefix(secret)
    if not prefix:
        return set()
    expected_hash = hash_token_secret(secret)
    session = session_factory()
    try:
        candidates = session.scalars(select(ApiToken).where(ApiToken.prefix == prefix)).all()
        for token in candidates:
            if not hmac.compare_digest(token.hashed_secret, expected_hash):
                continue
            if not token.is_active:
                return set()
            user = session.get(User, token.user_id)
            if user is None or not user.is_active:
                return set()
            return set(token.scopes)
        return set()
    finally:
        session.close()


def _default_db_url() -> str:
    """Return the URL pointing at the project's `.govforge/govforge.db`.

    Resolution order:
    1. `$GOVFORGE_DB` (env var) — wins outright.
    2. `./.govforge/govforge.db` (cwd) — created if the directory exists.
    3. `~/.govforge/govforge.db` — fallback for ad-hoc invocation.
    """
    env = os.environ.get("GOVFORGE_DB")
    if env:
        return env if "://" in env else f"sqlite:///{env}"
    local = Path.cwd() / ".govforge" / "govforge.db"
    if local.parent.exists():
        return f"sqlite:///{local}"
    home = Path.home() / ".govforge" / "govforge.db"
    home.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{home}"


def main() -> int:
    """Stdio MCP entry point. Used by `python -m govforge.mcp.server`."""
    url = _default_db_url()
    engine = make_engine(url)
    factory = make_session_factory(engine)
    scopes = resolve_scopes(factory)
    server = build_server(factory, scopes=scopes)
    server.run()  # defaults to stdio
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


__all__ = ["build_server", "main", "resolve_scopes"]
