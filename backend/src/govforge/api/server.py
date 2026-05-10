"""Uvicorn entry point — `python -m govforge.api.server`.

Binds to 127.0.0.1:8787 by default. Override with:

- ``$GOVFORGE_API_HOST`` / ``$GOVFORGE_API_PORT``
- ``$GOVFORGE_DB`` for the database (same resolution as the MCP server)
"""

from __future__ import annotations

import os
from pathlib import Path

import uvicorn

from govforge.api.app import create_app
from govforge.db.session import make_engine, make_session_factory


def _default_db_url() -> str:
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
    host = os.environ.get("GOVFORGE_API_HOST", "127.0.0.1")
    port = int(os.environ.get("GOVFORGE_API_PORT", "8787"))
    engine = make_engine(_default_db_url())
    if os.environ.get("GOVFORGE_BOOTSTRAP_SCHEMA") == "1":
        # Create core tables on first start. Idempotent — only creates
        # what's missing. Phase 1 only; Alembic supersedes this later.
        from govforge.db.session import create_all

        create_all(engine)
    factory = make_session_factory(engine)
    app = create_app(factory)
    uvicorn.run(app, host=host, port=port, log_level="info")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


__all__ = ["main"]
