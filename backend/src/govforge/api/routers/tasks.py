"""Task endpoints."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from govforge.api.deps import get_session
from govforge.api.schemas import TaskIn, TaskOut
from govforge.core.enums import TaskStatus
from govforge.core.services import TaskService
from govforge.mcp.context import get_or_create_agent, resolve_project, resolve_task

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskOut])
def list_tasks(
    project_path: str = Query(..., description="Filter by project root_path"),
    status: TaskStatus | None = Query(None),
    session: Session = Depends(get_session),
) -> list[TaskOut]:
    project = resolve_project(session, project_path)
    rows = TaskService(session).list(project_id=project.id, status=status)
    return [TaskOut.model_validate(r) for r in rows]


@router.post("", response_model=TaskOut, status_code=201)
def create_task(
    payload: TaskIn,
    session: Session = Depends(get_session),
) -> TaskOut:
    project = resolve_project(session, payload.project_path)
    actor = get_or_create_agent(session, payload.actor_agent) if payload.actor_agent else None
    task = TaskService(session).create(
        project_id=project.id,
        title=payload.title,
        description=payload.description,
        risk_level=payload.risk_level,
        created_by_agent_id=actor.id if actor else None,
    )
    return TaskOut.model_validate(task)


@router.get("/{task_id}", response_model=TaskOut)
def get_task(
    task_id: str,
    session: Session = Depends(get_session),
) -> TaskOut:
    """Look up by display_id (TASK-NNN) or UUID."""
    if task_id.startswith("TASK-"):
        task = resolve_task(session, display_id=task_id)
    else:
        try:
            uid = UUID(task_id)
        except ValueError as e:
            raise HTTPException(404, detail=f"task not found: {task_id}") from e
        from govforge.core.models import Task

        row = session.get(Task, uid)
        if row is None:
            raise HTTPException(404, detail=f"task not found: {task_id}")
        task = row
    return TaskOut.model_validate(task)
