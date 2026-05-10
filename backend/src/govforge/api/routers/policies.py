"""Policy endpoints — list registered policies + run checks for a decision."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from govforge.api.auth import RequireToken
from govforge.api.deps import get_session
from govforge.api.schemas import PolicyCheckIn, PolicyOut, PolicyResultOut
from govforge.core.enums import TokenScope
from govforge.core.models import Policy
from govforge.core.services import PolicyService
from govforge.mcp.context import get_or_create_agent, resolve_decision

router = APIRouter(prefix="/policies", tags=["policies"])


@router.get(
    "",
    response_model=list[PolicyOut],
    dependencies=[Depends(RequireToken(scope=TokenScope.POLICIES_READ))],
)
def list_policies(session: Session = Depends(get_session)) -> list[PolicyOut]:
    rows = session.query(Policy).order_by(Policy.name.asc()).all()
    return [PolicyOut.model_validate(r) for r in rows]


@router.post(
    "/check",
    response_model=list[PolicyResultOut],
    status_code=201,
    dependencies=[Depends(RequireToken(scope=TokenScope.POLICIES_READ))],
)
def check_policies(
    payload: PolicyCheckIn,
    session: Session = Depends(get_session),
) -> list[PolicyResultOut]:
    decision = resolve_decision(session, display_id=payload.decision_id)
    actor = get_or_create_agent(session, payload.actor_agent) if payload.actor_agent else None
    results = PolicyService(session).run_for_decision(
        decision_id=decision.id,
        config_path=payload.config_path,
        actor_agent_id=actor.id if actor else None,
    )
    return [PolicyResultOut.model_validate(r) for r in results]
