"""Reviews + Findings. Reviews are submitted by agents (or humans); findings hang off them."""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from govforge.core.enums import DecisionStatus, ReviewStatus
from govforge.core.ids import PREFIX_REVIEW, format_display_id
from govforge.core.models import Decision, Finding, Review
from govforge.core.services.event_service import EventService
from govforge.core.services.exceptions import NotFoundError
from govforge.core.services.inputs import FindingInput


class ReviewService:
    def __init__(
        self,
        session: Session,
        event_service: EventService | None = None,
    ) -> None:
        self.session = session
        self.events = event_service or EventService(session)

    def request(
        self,
        *,
        decision_id: UUID,
        reviewer_agent_id: UUID,
        focus: list[str] | None = None,
        actor_agent_id: UUID | None = None,
    ) -> Decision:
        """Mark a decision as awaiting review and emit an event.

        Returns the updated Decision (status = REVIEW_REQUIRED). The actual
        Review row is created when the reviewer calls `submit`.
        """
        decision = self._get_decision_or_404(decision_id)
        decision.status = DecisionStatus.REVIEW_REQUIRED
        self.session.flush()
        self.events.log(
            project_id=decision.project_id,
            entity_type="decision",
            entity_id=decision.id,
            event_type="review.requested",
            actor_agent_id=actor_agent_id,
            payload={
                "reviewer_agent_id": str(reviewer_agent_id),
                "focus": list(focus) if focus else [],
            },
        )
        return decision

    def submit(
        self,
        *,
        decision_id: UUID,
        reviewer_agent_id: UUID,
        status: ReviewStatus,
        summary: str | None = None,
        findings: Sequence[FindingInput] | None = None,
    ) -> Review:
        """Persist a Review (with findings) and update the decision status accordingly."""
        decision = self._get_decision_or_404(decision_id)
        next_seq = self._next_seq(decision.project_id)
        review = Review(
            decision_id=decision_id,
            reviewer_agent_id=reviewer_agent_id,
            display_id=format_display_id(PREFIX_REVIEW, next_seq),
            status=status,
            summary=summary,
        )
        self.session.add(review)
        self.session.flush()

        for f in findings or []:
            finding = Finding(
                review_id=review.id,
                severity=f.severity,
                category=f.category,
                file_path=f.file_path,
                line_start=f.line_start,
                line_end=f.line_end,
                message=f.message,
                recommendation=f.recommendation,
            )
            self.session.add(finding)
        self.session.flush()

        # Translate review status into a decision status update where unambiguous.
        new_decision_status: DecisionStatus | None = None
        if status == ReviewStatus.CHANGES_REQUESTED:
            new_decision_status = DecisionStatus.CHANGES_REQUESTED
        elif status == ReviewStatus.REJECTED:
            new_decision_status = DecisionStatus.REJECTED
        # APPROVED / COMMENTED do NOT auto-approve the decision —
        # the human approval gate (workstream: ApprovalService) is required.

        if new_decision_status is not None and decision.status != new_decision_status:
            old = decision.status
            decision.status = new_decision_status
            self.session.flush()
            self.events.log(
                project_id=decision.project_id,
                entity_type="decision",
                entity_id=decision.id,
                event_type="decision.status_changed",
                actor_agent_id=reviewer_agent_id,
                payload={"from": old.value, "to": new_decision_status.value},
            )

        self.events.log(
            project_id=decision.project_id,
            entity_type="review",
            entity_id=review.id,
            event_type="review.submitted",
            actor_agent_id=reviewer_agent_id,
            payload={
                "decision_id": str(decision_id),
                "display_id": review.display_id,
                "status": status.value,
                "findings_count": len(findings) if findings else 0,
            },
        )
        return review

    def get(self, review_id: UUID) -> Review | None:
        return self.session.get(Review, review_id)

    def get_or_404(self, review_id: UUID) -> Review:
        review = self.get(review_id)
        if review is None:
            raise NotFoundError(f"review not found: {review_id}")
        return review

    def list_for_decision(self, decision_id: UUID) -> list[Review]:
        return (
            self.session.query(Review)
            .filter(Review.decision_id == decision_id)
            .order_by(Review.created_at.asc())
            .all()
        )

    def list_open(self, *, project_id: UUID) -> list[Review]:
        """Reviews on decisions that are still in REVIEW_REQUIRED state."""
        return (
            self.session.query(Review)
            .join(Decision)
            .filter(
                Decision.project_id == project_id,
                Decision.status == DecisionStatus.REVIEW_REQUIRED,
            )
            .order_by(Review.created_at.asc())
            .all()
        )

    def _get_decision_or_404(self, decision_id: UUID) -> Decision:
        decision = self.session.get(Decision, decision_id)
        if decision is None:
            raise NotFoundError(f"decision not found: {decision_id}")
        return decision

    def _next_seq(self, project_id: UUID) -> int:
        stmt = (
            select(func.count())
            .select_from(Review)
            .join(Decision)
            .where(Decision.project_id == project_id)
        )
        count = self.session.execute(stmt).scalar() or 0
        return int(count) + 1
