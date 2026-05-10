"""FastAPI application factory.

`create_app(session_factory)` returns a fully wired FastAPI instance:
- CORS open to localhost (UI runs on a different port)
- domain exception handlers (NotFoundError → 404, InvariantError → 409)
- all routers from :mod:`govforge.api.routers` mounted

OpenAPI is auto-served on `/docs` and `/openapi.json`.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, sessionmaker

from govforge import __version__
from govforge.api.errors import install_exception_handlers
from govforge.api.routers import (
    decisions,
    events,
    health,
    policies,
    projects,
    reviews,
    tasks,
)


def create_app(session_factory: sessionmaker[Session]) -> FastAPI:
    """Build the FastAPI app bound to the given session factory."""
    app = FastAPI(
        title="GovForge API",
        version=__version__,
        description=(
            "Local HTTP API consumed by the `gf` CLI and the cockpit UI. "
            "Binds to 127.0.0.1:8787 by default; not exposed to the network."
        ),
    )
    app.state.session_factory = session_factory

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:8788",
            "http://127.0.0.1:8788",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    install_exception_handlers(app)

    app.include_router(health.router)
    app.include_router(projects.router)
    app.include_router(tasks.router)
    app.include_router(decisions.router)
    app.include_router(reviews.router)
    app.include_router(policies.router)
    app.include_router(events.router)

    return app


__all__ = ["create_app"]
