"""Disagreement endpoints.

Mirrors the MCP `record_disagreement` tool so non-agent callers (the
`gf disagreement` CLI, CI scripts, the cockpit UI) can record structured
disagreements without wiring up an MCP client. The HTTP scope is
`REVIEWS_WRITE` to stay consistent with the MCP `TOOL_SCOPES` mapping
(disagreements are part of the reviewer surface, not a separate role).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from govforge.api.auth import RequireToken
from govforge.api.deps import get_session
from govforge.api.schemas import DisagreementOut, DisagreementRecordIn
from govforge.core.enums import TokenScope
from govforge.core.services import DisagreementService
from govforge.mcp.context import get_or_create_agent, resolve_decision

router = APIRouter(tags=["disagreements"])


@router.post(
    "/disagreements",
    response_model=DisagreementOut,
    status_code=201,
    dependencies=[Depends(RequireToken(scope=TokenScope.REVIEWS_WRITE))],
)
def record_disagreement(
    payload: DisagreementRecordIn,
    session: Session = Depends(get_session),
) -> DisagreementOut:
    decision = resolve_decision(session, display_id=payload.decision_id)
    actor = (
        get_or_create_agent(session, payload.actor_agent) if payload.actor_agent else None
    )
    d = DisagreementService(session).record(
        decision_id=decision.id,
        topic=payload.topic,
        author_position=payload.author_position,
        reviewer_position=payload.reviewer_position,
        risk_summary=payload.risk_summary,
        requires_human_decision=payload.requires_human_decision,
        actor_agent_id=actor.id if actor else None,
    )
    return DisagreementOut.model_validate(d)


@router.get(
    "/disagreements",
    response_model=list[DisagreementOut],
    dependencies=[Depends(RequireToken(scope=TokenScope.REVIEWS_READ))],
)
def list_disagreements_for_decision(
    decision_id: str = Query(..., description="Decision display ID (e.g. DEC-001)"),
    session: Session = Depends(get_session),
) -> list[DisagreementOut]:
    decision = resolve_decision(session, display_id=decision_id)
    rows = DisagreementService(session).list_for_decision(decision.id)
    return [DisagreementOut.model_validate(r) for r in rows]
