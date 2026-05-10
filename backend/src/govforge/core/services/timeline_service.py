"""Timeline — chronological view of events for a decision or task."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import or_
from sqlalchemy.orm import Session

from govforge.core.models import Decision, Event


class TimelineService:
    """Builds chronological event timelines for the UI cockpit and CLI."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def for_decision(self, decision_id: UUID) -> list[Event]:
        """All events with `entity_type='decision'` for this decision_id, plus
        events on its sub-entities (review, disagreement, approval) when those
        sub-entities reference the decision via the payload."""
        # Direct events on the decision itself
        return (
            self.session.query(Event)
            .filter(
                or_(
                    (Event.entity_type == "decision") & (Event.entity_id == decision_id),
                    (Event.entity_type == "review")
                    & (Event.payload_json["decision_id"].as_string() == str(decision_id)),
                )
            )
            .order_by(Event.created_at.asc())
            .all()
        )

    def for_task(self, task_id: UUID) -> list[Event]:
        """All events for the task itself + events for every decision on the task."""
        decision_ids = [
            d.id for d in self.session.query(Decision).filter(Decision.task_id == task_id).all()
        ]
        return (
            self.session.query(Event)
            .filter(
                or_(
                    (Event.entity_type == "task") & (Event.entity_id == task_id),
                    (Event.entity_type == "decision") & Event.entity_id.in_(decision_ids),
                )
            )
            .order_by(Event.created_at.asc())
            .all()
        )
