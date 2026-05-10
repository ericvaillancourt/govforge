"""FastAPI dependency-injection helpers.

The session factory is stashed on `app.state.session_factory` by
`create_app`. Each request gets a fresh session via :func:`get_session`,
which commits on success and rolls back on exception — same contract as
the MCP server's `ServerContext.session`.
"""

from __future__ import annotations

from collections.abc import Iterator

from fastapi import Request
from sqlalchemy.orm import Session, sessionmaker


def get_session(request: Request) -> Iterator[Session]:
    """Yield a request-scoped DB session."""
    factory: sessionmaker[Session] = request.app.state.session_factory
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


__all__ = ["get_session"]
