"""FastMCP server factory + stdio entry point.

`build_server(session_factory)` returns a configured `FastMCP` instance with
all 11 tools, 5 resources, and 3 prompts registered. The same factory is
used by tests (in-process Client) and by the stdio entry point.

Run as ``python -m govforge.mcp.server`` (uses the database at
``$GOVFORGE_DB`` or `.govforge/govforge.db`).
"""

from __future__ import annotations

import os
from pathlib import Path

from fastmcp import FastMCP

from govforge.db.session import make_engine, make_session_factory
from govforge.mcp.context import ServerContext, SessionFactory
from govforge.mcp.prompts import register_prompts
from govforge.mcp.resources import register_resources
from govforge.mcp.tools import register_tools


def build_server(
    session_factory: SessionFactory,
    *,
    name: str = "govforge",
) -> FastMCP:
    """Construct a FastMCP server with every phase-1 capability registered."""
    server: FastMCP = FastMCP(name)
    ctx = ServerContext(session_factory=session_factory)
    register_tools(server, ctx)
    register_resources(server, ctx)
    register_prompts(server)
    return server


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
    server = build_server(factory)
    server.run()  # defaults to stdio
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


__all__ = ["build_server", "main"]
