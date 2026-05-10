"""Pure policy runner — no DB, no Git I/O.

Given a `PolicyContext` and a list of `Policy` instances, evaluate each and
return the verdicts. Policies that return `None` (don't apply) are skipped.

Persistence (PolicyResult rows + Event rows) lives in
`govforge.core.services.policy_service`.
"""

from __future__ import annotations

from dataclasses import dataclass

from govforge.core.policies.base import Policy, PolicyContext, PolicyVerdict


@dataclass(frozen=True)
class PolicyOutcome:
    """One policy's result for a given context."""

    policy: Policy
    verdict: PolicyVerdict


def run_policies(
    policies: list[Policy],
    ctx: PolicyContext,
) -> list[PolicyOutcome]:
    """Evaluate every policy in order; drop ones that return None."""
    outcomes: list[PolicyOutcome] = []
    for policy in policies:
        verdict = policy.evaluate(ctx)
        if verdict is None:
            continue
        outcomes.append(PolicyOutcome(policy=policy, verdict=verdict))
    return outcomes


__all__ = [
    "PolicyOutcome",
    "run_policies",
]
