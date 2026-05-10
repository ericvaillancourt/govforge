"""Tasks — units of governed work, parents of decisions."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from govforge.core.enums import RiskLevel, TaskStatus
from govforge.core.ids import PREFIX_TASK, format_display_id
from govforge.core.models import Task
from govforge.core.services.event_service import EventService
from govforge.core.services.exceptions import NotFoundError


class TaskService:
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
        title: str,
        description: str | None = None,
        risk_level: RiskLevel = RiskLevel.MEDIUM,
        created_by_agent_id: UUID | None = None,
    ) -> Task:
        next_seq = self._next_seq(project_id)
        task = Task(
            project_id=project_id,
            display_id=format_display_id(PREFIX_TASK, next_seq),
            title=title,
            description=description,
            risk_level=risk_level,
            created_by_agent_id=created_by_agent_id,
        )
        self.session.add(task)
        self.session.flush()
        self.events.log(
            project_id=project_id,
            entity_type="task",
            entity_id=task.id,
            event_type="task.created",
            actor_agent_id=created_by_agent_id,
            payload={
                "display_id": task.display_id,
                "title": title,
                "risk_level": risk_level.value,
            },
        )
        return task

    def get(self, task_id: UUID) -> Task | None:
        return self.session.get(Task, task_id)

    def get_or_404(self, task_id: UUID) -> Task:
        task = self.get(task_id)
        if task is None:
            raise NotFoundError(f"task not found: {task_id}")
        return task

    def get_by_display_id(self, *, project_id: UUID, display_id: str) -> Task | None:
        return (
            self.session.query(Task)
            .filter(Task.project_id == project_id, Task.display_id == display_id)
            .first()
        )

    def list(
        self,
        *,
        project_id: UUID,
        status: TaskStatus | None = None,
    ) -> list[Task]:
        q = self.session.query(Task).filter(Task.project_id == project_id)
        if status is not None:
            q = q.filter(Task.status == status)
        return q.order_by(Task.created_at.asc()).all()

    def update_status(
        self,
        *,
        task_id: UUID,
        status: TaskStatus,
        actor_agent_id: UUID | None = None,
    ) -> Task:
        task = self.get_or_404(task_id)
        old_status = task.status
        if old_status == status:
            return task
        task.status = status
        self.session.flush()
        self.events.log(
            project_id=task.project_id,
            entity_type="task",
            entity_id=task.id,
            event_type="task.status_changed",
            actor_agent_id=actor_agent_id,
            payload={"from": old_status.value, "to": status.value},
        )
        return task

    def _next_seq(self, project_id: UUID) -> int:
        stmt = select(func.count()).select_from(Task).where(Task.project_id == project_id)
        count = self.session.execute(stmt).scalar() or 0
        return int(count) + 1
