"""Map service-layer exceptions to FastAPI JSON responses."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from govforge.core.services import InvariantError, NotFoundError
from govforge.mcp.context import EntityNotFound


def install_exception_handlers(app: FastAPI) -> None:
    """Translate domain errors into proper HTTP responses."""

    @app.exception_handler(NotFoundError)
    async def _not_found(_request: Request, exc: NotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(EntityNotFound)
    async def _entity_not_found(_request: Request, exc: EntityNotFound) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(InvariantError)
    async def _invariant(_request: Request, exc: InvariantError) -> JSONResponse:
        return JSONResponse(status_code=409, content={"detail": str(exc)})


__all__ = ["install_exception_handlers"]
