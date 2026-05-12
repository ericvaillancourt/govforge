"""Decision endpoints."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from govforge.api.auth import RequireToken
from govforge.api.deps import get_session
from govforge.api.schemas import (
    ApprovalIn,
    ApprovalOut,
    AttachGitIn,
    DecisionIn,
    DecisionOut,
    EventOut,
    GitChangeOut,
)
from govforge.core.enums import DecisionStatus, TokenScope
from govforge.core.services import (
    ApprovalService,
    DecisionService,
    TimelineService,
)
from govforge.mcp.context import (
    get_or_create_agent,
    resolve_decision,
    resolve_project,
    resolve_task,
)

router = APIRouter(prefix="/decisions", tags=["decisions"])


def _resolve(session: Session, decision_id: str):  # type: ignore[no-untyped-def]
    """Accept either DEC-NNN or a UUID string."""
    if decision_id.startswith("DEC-"):
        return resolve_decision(session, display_id=decision_id)
    try:
        uid = UUID(decision_id)
    except ValueError as e:
        raise HTTPException(404, detail=f"decision not found: {decision_id}") from e
    from govforge.core.models import Decision

    row = session.get(Decision, uid)
    if row is None:
        raise HTTPException(404, detail=f"decision not found: {decision_id}")
    return row


@router.get(
    "",
    response_model=list[DecisionOut],
    dependencies=[Depends(RequireToken(scope=TokenScope.DECISIONS_READ))],
)
def list_decisions(
    project_path: str = Query(...),
    status: DecisionStatus | None = Query(None),
    session: Session = Depends(get_session),
) -> list[DecisionOut]:
    project = resolve_project(session, project_path)
    rows = DecisionService(session).list(project_id=project.id, status=status)
    return [DecisionOut.model_validate(r) for r in rows]


@router.post(
    "",
    response_model=DecisionOut,
    status_code=201,
    dependencies=[Depends(RequireToken(scope=TokenScope.DECISIONS_WRITE))],
)
def create_decision(
    payload: DecisionIn,
    session: Session = Depends(get_session),
) -> DecisionOut:
    task = resolve_task(session, display_id=payload.task_id)
    author = get_or_create_agent(session, payload.author_agent)
    decision = DecisionService(session).create(
        project_id=task.project_id,
        task_id=task.id,
        author_agent_id=author.id,
        title=payload.title,
        summary=payload.summary,
        rationale=payload.rationale,
        risk_level=payload.risk_level,
        human_approval_required=payload.human_approval_required,
    )
    return DecisionOut.model_validate(decision)


@router.get(
    "/{decision_id}",
    response_model=DecisionOut,
    dependencies=[Depends(RequireToken(scope=TokenScope.DECISIONS_READ))],
)
def get_decision(
    decision_id: str,
    session: Session = Depends(get_session),
) -> DecisionOut:
    return DecisionOut.model_validate(_resolve(session, decision_id))


@router.get(
    "/{decision_id}/timeline",
    response_model=list[EventOut],
    dependencies=[Depends(RequireToken(scope=TokenScope.DECISIONS_READ))],
)
def get_timeline(
    decision_id: str,
    session: Session = Depends(get_session),
) -> list[EventOut]:
    decision = _resolve(session, decision_id)
    events = TimelineService(session).for_decision(decision.id)
    return [EventOut.model_validate(e) for e in events]


@router.post(
    "/{decision_id}/attach-git",
    response_model=GitChangeOut,
    status_code=201,
    dependencies=[Depends(RequireToken(scope=TokenScope.DECISIONS_WRITE))],
)
def attach_git(
    decision_id: str,
    payload: AttachGitIn,
    session: Session = Depends(get_session),
) -> GitChangeOut:
    decision = _resolve(session, decision_id)
    actor = get_or_create_agent(session, payload.actor_agent) if payload.actor_agent else None
    gc = DecisionService(session).attach_git(
        decision_id=decision.id,
        repo_path=payload.repo_path,
        rev=payload.commit_hash,
        actor_agent_id=actor.id if actor else None,
    )
    return GitChangeOut.model_validate(gc)


@router.post(
    "/{decision_id}/approve",
    response_model=ApprovalOut,
    status_code=201,
    dependencies=[Depends(RequireToken(scope=TokenScope.APPROVALS_WRITE))],
)
def approve_decision(
    decision_id: str,
    payload: ApprovalIn,
    session: Session = Depends(get_session),
) -> ApprovalOut:
    decision = _resolve(session, decision_id)
    approver = get_or_create_agent(session, payload.approver)
    approval = ApprovalService(session).approve(
        decision_id=decision.id,
        approver_agent_id=approver.id,
        comment=payload.comment,
    )
    return ApprovalOut.model_validate(approval)


@router.post(
    "/{decision_id}/reject",
    response_model=ApprovalOut,
    status_code=201,
    dependencies=[Depends(RequireToken(scope=TokenScope.APPROVALS_WRITE))],
)
def reject_decision(
    decision_id: str,
    payload: ApprovalIn,
    session: Session = Depends(get_session),
) -> ApprovalOut:
    decision = _resolve(session, decision_id)
    approver = get_or_create_agent(session, payload.approver)
    approval = ApprovalService(session).reject(
        decision_id=decision.id,
        approver_agent_id=approver.id,
        comment=payload.comment,
    )
    return ApprovalOut.model_validate(approval)
