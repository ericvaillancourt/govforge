"""SQLAlchemy engine + session factory for GovForge.

Phase 1 uses SQLite local-only at `.govforge/govforge.db`. Phase 3 SaaS will
add PostgreSQL via the same `DATABASE_URL` knob.
"""

from __future__ import annotations

import os
from collections.abc import Generator
from pathlib import Path
from typing import Any

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from govforge.core.models import Base


def default_database_url(repo_root: Path | str | None = None) -> str:
    """Return the default SQLite URL for the given repo root."""
    root = Path(repo_root) if repo_root else Path.cwd()
    db_path = root / ".govforge" / "govforge.db"
    return f"sqlite:///{db_path}"


def make_engine(database_url: str | None = None, *, echo: bool = False) -> Engine:
    """Create an Engine. SQLite gets pragmas tuned for app use; PostgreSQL
    gets a small connection pool and pre-ping so stale TCP connections to
    the DB are recycled rather than served to a request."""
    url = database_url or os.environ.get("GOVFORGE_DATABASE_URL") or default_database_url()
    is_sqlite = url.startswith("sqlite")
    kwargs: dict[str, Any] = {
        "echo": echo,
        "future": True,
        "connect_args": {"check_same_thread": False} if is_sqlite else {},
    }
    if not is_sqlite:
        kwargs["pool_pre_ping"] = True
        kwargs["pool_size"] = int(os.environ.get("GOVFORGE_DB_POOL_SIZE", "5"))
        kwargs["max_overflow"] = int(os.environ.get("GOVFORGE_DB_MAX_OVERFLOW", "10"))
    engine = create_engine(url, **kwargs)
    if is_sqlite:
        # Enable foreign key enforcement and reasonable durability.
        @event.listens_for(engine, "connect")
        def _sqlite_pragmas(dbapi_conn: Any, _conn_record: Any) -> None:
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA foreign_keys = ON")
            cur.execute("PRAGMA journal_mode = WAL")
            cur.execute("PRAGMA synchronous = NORMAL")
            cur.close()

    return engine


def make_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)


def create_all(engine: Engine) -> None:
    """Create all tables. Used by `gf init` and tests; production goes via Alembic."""
    Base.metadata.create_all(bind=engine)


def session_scope(factory: sessionmaker[Session]) -> Generator[Session]:
    """Context-manager-ish helper: commit on success, rollback on error."""
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
