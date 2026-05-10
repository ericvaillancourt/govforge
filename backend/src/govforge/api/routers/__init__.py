"""API routers — one APIRouter per resource."""

from govforge.api.routers import (
    decisions,
    events,
    health,
    policies,
    projects,
    reviews,
    tasks,
)

__all__ = [
    "decisions",
    "events",
    "health",
    "policies",
    "projects",
    "reviews",
    "tasks",
]
