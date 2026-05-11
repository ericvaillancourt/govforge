"""Run Alembic migrations in any environment (checkout, venv, container).

This wrapper builds the Alembic Config in code rather than reading
`alembic.ini` from disk, so it works the same whether the package is
installed from a wheel (production container — `alembic.ini` isn't
shipped) or a source checkout.

Usage:
  python -m govforge.scripts.migrate upgrade head
  python -m govforge.scripts.migrate stamp head
  python -m govforge.scripts.migrate current
  python -m govforge.scripts.migrate history
  python -m govforge.scripts.migrate check
  python -m govforge.scripts.migrate downgrade <rev>

Database URL resolution follows the same env-var precedence as the API
runtime (env.py also reads these): `GOVFORGE_DATABASE_URL` then
`GOVFORGE_DB`, falling back to the local-dev SQLite path.
"""

from __future__ import annotations

import logging
import sys
from importlib.resources import files

from alembic import command
from alembic.config import Config


def _make_config() -> Config:
    """Build an Alembic Config that points at the packaged migration tree."""
    cfg = Config()
    cfg.set_main_option(
        "script_location", str(files("govforge.db.migrations"))
    )
    # `version_table` keeps a single source of truth for migration bookkeeping.
    cfg.set_main_option("version_table", "alembic_version")
    # Render ALTER TABLE on SQLite via batch mode — needed for future
    # add-column/drop-column migrations on local-dev databases.
    cfg.set_main_option("render_as_batch", "true")
    return cfg


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    if not argv:
        sys.stderr.write(
            "usage: govforge-migrate <upgrade|downgrade|stamp|current|"
            "history|heads|check> [target]\n"
        )
        return 2

    # Make Alembic's output visible at INFO level so users can see what it
    # actually did (default is WARN which hides upgrade messages).
    logging.basicConfig(
        level=logging.INFO,
        format="%(levelname)-5.5s [%(name)s] %(message)s",
        stream=sys.stderr,
    )
    logging.getLogger("alembic").setLevel(logging.INFO)

    cmd, *args = argv
    cfg = _make_config()

    if cmd == "upgrade":
        command.upgrade(cfg, args[0] if args else "head")
    elif cmd == "downgrade":
        if not args:
            sys.stderr.write("downgrade requires a target revision\n")
            return 2
        command.downgrade(cfg, args[0])
    elif cmd == "stamp":
        command.stamp(cfg, args[0] if args else "head")
    elif cmd == "current":
        command.current(cfg)
    elif cmd == "history":
        command.history(cfg)
    elif cmd == "heads":
        command.heads(cfg)
    elif cmd == "check":
        command.check(cfg)
    else:
        sys.stderr.write(f"unknown subcommand: {cmd}\n")
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
