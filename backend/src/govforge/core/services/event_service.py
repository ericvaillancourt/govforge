"""Append-only event log. Every other service routes its audit trail through this."""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy.orm import Session

from govforge.core.models import Event

if TYPE_CHECKING:
    pass


class EventService:
    """Persists `Event` rows. Never updates or deletes — append-only by contract."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def log(
        self,
        *,
        project_id: UUID,
        entity_type: str,
        entity_id: UUID,
        event_type: str,
        actor_agent_id: UUID | None = None,
        payload: dict[str, object] | None = None,
    ) -> Event:
        """Append a new event. Returns the persisted `Event` (id assigned)."""
        event = Event(
            project_id=project_id,
            entity_type=entity_type,
            entity_id=entity_id,
            event_type=event_type,
            actor_agent_id=actor_agent_id,
            payload_json=payload,
        )
        self.session.add(event)
        self.session.flush()
        return event

    def list_for_entity(self, *, entity_type: str, entity_id: UUID) -> list[Event]:
        """Chronological events for a single entity."""
        return (
            self.session.query(Event)
            .filter(Event.entity_type == entity_type, Event.entity_id == entity_id)
            .order_by(Event.created_at.asc())
            .all()
        )

    def list_for_project(self, *, project_id: UUID, limit: int = 100) -> list[Event]:
        """Most-recent-first events for a project."""
        return (
            self.session.query(Event)
            .filter(Event.project_id == project_id)
            .order_by(Event.created_at.desc())
            .limit(limit)
            .all()
        )
