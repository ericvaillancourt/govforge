"""Event endpoints — read-only audit log access."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from govforge.api.deps import get_session
from govforge.api.schemas import EventOut
from govforge.core.services import EventService
from govforge.mcp.context import (
    resolve_decision,
    resolve_project,
    resolve_review,
    resolve_task,
)

router = APIRouter(prefix="/events", tags=["events"])


@router.get("", response_model=list[EventOut])
def list_events(
    project_path: str | None = Query(None),
    entity_type: str | None = Query(None),
    entity_id: str | None = Query(None),
    session: Session = Depends(get_session),
) -> list[EventOut]:
    """List events. Either filter by project (project_path) or by entity.

    `entity_id` accepts a display ID (`DEC-001`, `TASK-001`, `REV-001`) or
    a UUID string; the type is inferred from `entity_type`.
    """
    svc = EventService(session)
    if entity_type and entity_id:
        uid = _resolve_entity_uuid(session, entity_type=entity_type, entity_id=entity_id)
        rows = svc.list_for_entity(entity_type=entity_type, entity_id=uid)
    elif project_path:
        project = resolve_project(session, project_path)
        rows = svc.list_for_project(project_id=project.id)
    else:
        raise HTTPException(
            400,
            detail="must provide either project_path or (entity_type + entity_id)",
        )
    return [EventOut.model_validate(r) for r in rows]


def _resolve_entity_uuid(session: Session, *, entity_type: str, entity_id: str) -> UUID:
    """Translate a display ID or UUID string into a UUID."""
    if entity_type == "decision" and entity_id.startswith("DEC-"):
        return resolve_decision(session, display_id=entity_id).id
    if entity_type == "task" and entity_id.startswith("TASK-"):
        return resolve_task(session, display_id=entity_id).id
    if entity_type == "review" and entity_id.startswith("REV-"):
        return resolve_review(session, display_id=entity_id).id
    try:
        return UUID(entity_id)
    except ValueError as e:
        raise HTTPException(400, detail=f"invalid entity_id: {entity_id}") from e
