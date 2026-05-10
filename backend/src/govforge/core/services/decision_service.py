"""Decisions — the central primitive. Wraps GitChange attachment + status transitions."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from govforge.core.enums import DecisionStatus, RiskLevel
from govforge.core.git import extract_commit
from govforge.core.ids import PREFIX_DECISION, format_display_id
from govforge.core.models import Decision, GitChange
from govforge.core.services.event_service import EventService
from govforge.core.services.exceptions import NotFoundError


class DecisionService:
    def __init__(
        self,
        session: Session,
        event_service: EventService | None = None,
    ) -> None:
        self.session = session
        self.events = event_service or EventService(session)

    def create(
        self,
        *,
        project_id: UUID,
        author_agent_id: UUID,
        title: str,
        task_id: UUID | None = None,
        summary: str | None = None,
        rationale: str | None = None,
        risk_level: RiskLevel = RiskLevel.MEDIUM,
        human_approval_required: bool = False,
    ) -> Decision:
        next_seq = self._next_seq(project_id)
        decision = Decision(
            project_id=project_id,
            task_id=task_id,
            author_agent_id=author_agent_id,
            display_id=format_display_id(PREFIX_DECISION, next_seq),
            title=title,
            summary=summary,
            rationale=rationale,
            risk_level=risk_level,
            human_approval_required=human_approval_required,
        )
        self.session.add(decision)
        self.session.flush()
        self.events.log(
            project_id=project_id,
            entity_type="decision",
            entity_id=decision.id,
            event_type="decision.created",
            actor_agent_id=author_agent_id,
            payload={
                "display_id": decision.display_id,
                "title": title,
                "risk_level": risk_level.value,
                "task_id": str(task_id) if task_id else None,
            },
        )
        return decision

    def get(self, decision_id: UUID) -> Decision | None:
        return self.session.get(Decision, decision_id)

    def get_or_404(self, decision_id: UUID) -> Decision:
        decision = self.get(decision_id)
        if decision is None:
            raise NotFoundError(f"decision not found: {decision_id}")
        return decision

    def get_by_display_id(self, *, project_id: UUID, display_id: str) -> Decision | None:
        return (
            self.session.query(Decision)
            .filter(
                Decision.project_id == project_id,
                Decision.display_id == display_id,
            )
            .first()
        )

    def list(
        self,
        *,
        project_id: UUID,
        status: DecisionStatus | None = None,
    ) -> list[Decision]:
        q = self.session.query(Decision).filter(Decision.project_id == project_id)
        if status is not None:
            q = q.filter(Decision.status == status)
        return q.order_by(Decision.created_at.asc()).all()

    def attach_git(
        self,
        *,
        decision_id: UUID,
        repo_path: str,
        rev: str = "HEAD",
        actor_agent_id: UUID | None = None,
    ) -> GitChange:
        """Run the Git extractor and persist a `GitChange` linked to this decision."""
        decision = self.get_or_404(decision_id)
        data = extract_commit(repo_path, rev)
        gc = GitChange(
            decision_id=decision.id,
            repo_path=data.repo_path,
            branch_name=data.branch_name,
            commit_hash=data.commit_hash,
            parent_commit_hash=data.parent_commit_hash,
            diff_hash=data.diff_hash,
            files_changed_json=list(data.files_changed),
            insertions=data.insertions,
            deletions=data.deletions,
        )
        self.session.add(gc)
        self.session.flush()
        self.events.log(
            project_id=decision.project_id,
            entity_type="decision",
            entity_id=decision.id,
            event_type="decision.git_attached",
            actor_agent_id=actor_agent_id,
            payload={
                "commit_hash": data.commit_hash,
                "branch_name": data.branch_name,
                "files_changed": list(data.files_changed),
                "insertions": data.insertions,
                "deletions": data.deletions,
            },
        )
        return gc

    def update_status(
        self,
        *,
        decision_id: UUID,
        status: DecisionStatus,
        actor_agent_id: UUID | None = None,
    ) -> Decision:
        decision = self.get_or_404(decision_id)
        old_status = decision.status
        if old_status == status:
            return decision
        decision.status = status
        self.session.flush()
        self.events.log(
            project_id=decision.project_id,
            entity_type="decision",
            entity_id=decision.id,
            event_type="decision.status_changed",
            actor_agent_id=actor_agent_id,
            payload={"from": old_status.value, "to": status.value},
        )
        return decision

    def _next_seq(self, project_id: UUID) -> int:
        stmt = select(func.count()).select_from(Decision).where(Decision.project_id == project_id)
        count = self.session.execute(stmt).scalar() or 0
        return int(count) + 1
