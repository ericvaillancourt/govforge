"""Structured disagreements between agents on a decision."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.orm import Session

from govforge.core.models import Decision, Disagreement
from govforge.core.services.event_service import EventService
from govforge.core.services.exceptions import NotFoundError


class DisagreementService:
    def __init__(
        self,
        session: Session,
        event_service: EventService | None = None,
    ) -> None:
        self.session = session
        self.events = event_service or EventService(session)

    def record(
        self,
        *,
        decision_id: UUID,
        topic: str,
        author_position: str | None = None,
        reviewer_position: str | None = None,
        risk_summary: str | None = None,
        requires_human_decision: bool = True,
        actor_agent_id: UUID | None = None,
    ) -> Disagreement:
        decision = self._get_decision_or_404(decision_id)
        d = Disagreement(
            decision_id=decision_id,
            topic=topic,
            author_position=author_position,
            reviewer_position=reviewer_position,
            risk_summary=risk_summary,
            requires_human_decision=requires_human_decision,
        )
        self.session.add(d)
        self.session.flush()
        self.events.log(
            project_id=decision.project_id,
            entity_type="disagreement",
            entity_id=d.id,
            event_type="disagreement.recorded",
            actor_agent_id=actor_agent_id,
            payload={
                "decision_id": str(decision_id),
                "topic": topic,
                "requires_human_decision": requires_human_decision,
            },
        )
        return d

    def resolve(
        self,
        *,
        disagreement_id: UUID,
        resolution: str,
        resolved_by_agent_id: UUID,
    ) -> Disagreement:
        d = self.session.get(Disagreement, disagreement_id)
        if d is None:
            raise NotFoundError(f"disagreement not found: {disagreement_id}")
        d.resolution = resolution
        d.resolved_by_agent_id = resolved_by_agent_id
        d.resolved_at = datetime.now(UTC)
        self.session.flush()

        decision = self.session.get(Decision, d.decision_id)
        project_id = decision.project_id if decision else None
        if project_id is not None:
            self.events.log(
                project_id=project_id,
                entity_type="disagreement",
                entity_id=d.id,
                event_type="disagreement.resolved",
                actor_agent_id=resolved_by_agent_id,
                payload={"resolution": resolution},
            )
        return d

    def list_for_decision(self, decision_id: UUID) -> list[Disagreement]:
        return (
            self.session.query(Disagreement)
            .filter(Disagreement.decision_id == decision_id)
            .order_by(Disagreement.created_at.asc())
            .all()
        )

    def _get_decision_or_404(self, decision_id: UUID) -> Decision:
        decision = self.session.get(Decision, decision_id)
        if decision is None:
            raise NotFoundError(f"decision not found: {decision_id}")
        return decision
