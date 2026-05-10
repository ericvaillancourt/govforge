"""GET /health — liveness probe."""

from __future__ import annotations

from fastapi import APIRouter

from govforge import __version__
from govforge.api.schemas import HealthOut

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthOut)
def health() -> HealthOut:
    return HealthOut(status="ok", version=__version__)
