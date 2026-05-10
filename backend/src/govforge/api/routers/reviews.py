"""Review endpoints."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from govforge.api.deps import get_session
from govforge.api.schemas import (
    DecisionOut,
    ReviewOut,
    ReviewRequestIn,
    ReviewSubmitIn,
)
from govforge.core.services import FindingInput, ReviewService
from govforge.mcp.context import (
    get_or_create_agent,
    resolve_decision,
    resolve_project,
    resolve_review,
)

router = APIRouter(tags=["reviews"])


@router.post("/reviews/request", response_model=DecisionOut, status_code=200)
def request_review(
    payload: ReviewRequestIn,
    session: Session = Depends(get_session),
) -> DecisionOut:
    decision = resolve_decision(session, display_id=payload.decision_id)
    reviewer = get_or_create_agent(session, payload.reviewer_agent)
    actor = get_or_create_agent(session, payload.actor_agent) if payload.actor_agent else None
    updated = ReviewService(session).request(
        decision_id=decision.id,
        reviewer_agent_id=reviewer.id,
        focus=payload.focus,
        actor_agent_id=actor.id if actor else None,
    )
    return DecisionOut.model_validate(updated)


@router.post("/reviews", response_model=ReviewOut, status_code=201)
def submit_review(
    payload: ReviewSubmitIn,
    session: Session = Depends(get_session),
) -> ReviewOut:
    decision = resolve_decision(session, display_id=payload.decision_id)
    reviewer = get_or_create_agent(session, payload.reviewer_agent)
    findings = [
        FindingInput(
            severity=f.severity,
            category=f.category,
            file_path=f.file_path,
            line_start=f.line_start,
            line_end=f.line_end,
            message=f.message,
            recommendation=f.recommendation,
        )
        for f in payload.findings
    ]
    review = ReviewService(session).submit(
        decision_id=decision.id,
        reviewer_agent_id=reviewer.id,
        status=payload.status,
        summary=payload.summary,
        findings=findings,
    )
    return ReviewOut.model_validate(review)


@router.get("/reviews", response_model=list[ReviewOut])
def list_reviews(
    project_path: str = Query(...),
    open_only: bool = Query(False),
    session: Session = Depends(get_session),
) -> list[ReviewOut]:
    project = resolve_project(session, project_path)
    svc = ReviewService(session)
    rows = (
        svc.list_open(project_id=project.id)
        if open_only
        else _list_all_for_project(session, project_id=project.id)
    )
    return [ReviewOut.model_validate(r) for r in rows]


@router.get("/reviews/{review_id}", response_model=ReviewOut)
def get_review(
    review_id: str,
    session: Session = Depends(get_session),
) -> ReviewOut:
    if review_id.startswith("REV-"):
        review = resolve_review(session, display_id=review_id)
    else:
        try:
            uid = UUID(review_id)
        except ValueError as e:
            raise HTTPException(404, detail=f"review not found: {review_id}") from e
        from govforge.core.models import Review

        row = session.get(Review, uid)
        if row is None:
            raise HTTPException(404, detail=f"review not found: {review_id}")
        review = row
    return ReviewOut.model_validate(review)


def _list_all_for_project(session: Session, *, project_id: object) -> list:  # type: ignore[type-arg]
    from govforge.core.models import Decision, Review

    return (
        session.query(Review)
        .join(Decision)
        .filter(Decision.project_id == project_id)
        .order_by(Review.created_at.asc())
        .all()
    )
