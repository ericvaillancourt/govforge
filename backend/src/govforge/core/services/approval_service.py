"""Human approvals — final gate. Drives the decision into APPROVED or REJECTED."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from govforge.core.enums import ApprovalStatus, DecisionStatus
from govforge.core.models import Approval, Decision
from govforge.core.services.event_service import EventService
from govforge.core.services.exceptions import NotFoundError


class ApprovalService:
    def __init__(
        self,
        session: Session,
        event_service: EventService | None = None,
    ) -> None:
        self.session = session
        self.events = event_service or EventService(session)

    def approve(
        self,
        *,
        decision_id: UUID,
        approver_agent_id: UUID,
        comment: str | None = None,
    ) -> Approval:
        return self._record(
            decision_id=decision_id,
            approver_agent_id=approver_agent_id,
            status=ApprovalStatus.APPROVED,
            new_decision_status=DecisionStatus.APPROVED,
            comment=comment,
            event_type="decision.approved",
        )

    def reject(
        self,
        *,
        decision_id: UUID,
        approver_agent_id: UUID,
        comment: str | None = None,
    ) -> Approval:
        return self._record(
            decision_id=decision_id,
            approver_agent_id=approver_agent_id,
            status=ApprovalStatus.REJECTED,
            new_decision_status=DecisionStatus.REJECTED,
            comment=comment,
            event_type="decision.rejected",
        )

    def needs_changes(
        self,
        *,
        decision_id: UUID,
        approver_agent_id: UUID,
        comment: str | None = None,
    ) -> Approval:
        return self._record(
            decision_id=decision_id,
            approver_agent_id=approver_agent_id,
            status=ApprovalStatus.NEEDS_CHANGES,
            new_decision_status=DecisionStatus.CHANGES_REQUESTED,
            comment=comment,
            event_type="decision.needs_changes",
        )

    def list_pending(self, *, project_id: UUID) -> list[Decision]:
        """Decisions awaiting human approval (REVIEW_REQUIRED + human_approval_required)."""
        return (
            self.session.query(Decision)
            .filter(
                Decision.project_id == project_id,
                Decision.human_approval_required.is_(True),
                Decision.status.in_(
                    (DecisionStatus.REVIEW_REQUIRED, DecisionStatus.CHANGES_REQUESTED)
                ),
            )
            .order_by(Decision.created_at.asc())
            .all()
        )

    def list_for_decision(self, decision_id: UUID) -> list[Approval]:
        return (
            self.session.query(Approval)
            .filter(Approval.decision_id == decision_id)
            .order_by(Approval.created_at.asc())
            .all()
        )

    def _record(
        self,
        *,
        decision_id: UUID,
        approver_agent_id: UUID,
        status: ApprovalStatus,
        new_decision_status: DecisionStatus,
        comment: str | None,
        event_type: str,
    ) -> Approval:
        decision = self.session.get(Decision, decision_id)
        if decision is None:
            raise NotFoundError(f"decision not found: {decision_id}")

        approval = Approval(
            decision_id=decision_id,
            approver_agent_id=approver_agent_id,
            status=status,
            comment=comment,
        )
        self.session.add(approval)

        old_decision_status = decision.status
        decision.status = new_decision_status
        self.session.flush()

        self.events.log(
            project_id=decision.project_id,
            entity_type="decision",
            entity_id=decision.id,
            event_type=event_type,
            actor_agent_id=approver_agent_id,
            payload={
                "approval_id": str(approval.id),
                "comment": comment,
                "from": old_decision_status.value,
                "to": new_decision_status.value,
            },
        )
        return approval
