"""Policy service — runs the policy engine against a decision and persists results.

The pure engine lives in `govforge.core.policies`; this module is the thin
DB wrapper that:

1. Ensures a `Policy` row exists for each registered policy name (idempotent).
2. Builds a `PolicyContext` from the decision's most recent GitChange.
3. Runs the engine and persists one `PolicyResult` row per outcome.
4. Emits an audit event summarising the run.
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy.orm import Session

from govforge.core.git import get_diff_text, open_repo
from govforge.core.models import Decision, GitChange, PolicyResult
from govforge.core.models import Policy as PolicyRow
from govforge.core.policies import (
    DEFAULT_POLICIES_BY_NAME,
    Policy,
    PolicyContext,
    PolicyOutcome,
    PolicySpec,
    instantiate_enabled,
    load_policy_specs,
    run_policies,
)
from govforge.core.services.event_service import EventService
from govforge.core.services.exceptions import NotFoundError

if TYPE_CHECKING:
    from pathlib import Path


class PolicyService:
    """Run the policy engine against a decision and persist results."""

    def __init__(
        self,
        session: Session,
        event_service: EventService | None = None,
    ) -> None:
        self.session = session
        self.events = event_service or EventService(session)

    # ------------------------------------------------------------------
    # Policy registry sync
    # ------------------------------------------------------------------

    def ensure_policy_row(self, spec: PolicySpec) -> PolicyRow:
        """Look up or create a `Policy` row for this spec. Updates enabled/severity."""
        existing = self.session.query(PolicyRow).filter(PolicyRow.name == spec.name).one_or_none()
        if existing is None:
            row = PolicyRow(
                name=spec.name,
                description=spec.cls.description,
                enabled=spec.enabled,
                severity=spec.severity,
                config_json=dict(spec.config),
            )
            self.session.add(row)
            self.session.flush()
            return row
        existing.enabled = spec.enabled
        existing.severity = spec.severity
        existing.config_json = dict(spec.config)
        existing.description = spec.cls.description
        self.session.flush()
        return existing

    def sync_policies(self, specs: list[PolicySpec]) -> dict[str, PolicyRow]:
        """Sync each spec into the DB; return name → PolicyRow."""
        return {spec.name: self.ensure_policy_row(spec) for spec in specs}

    # ------------------------------------------------------------------
    # Context construction
    # ------------------------------------------------------------------

    def _latest_git_change(self, decision_id: UUID) -> GitChange | None:
        return (
            self.session.query(GitChange)
            .filter(GitChange.decision_id == decision_id)
            .order_by(GitChange.created_at.desc())
            .first()
        )

    @staticmethod
    def _diff_text_for(git_change: GitChange | None) -> str | None:
        if git_change is None:
            return None
        try:
            repo = open_repo(git_change.repo_path)
            return get_diff_text(repo, git_change.commit_hash)
        except Exception:
            # Repo may be unreachable from the audit host; policies relying on
            # diff content will simply skip their content checks.
            return None

    # ------------------------------------------------------------------
    # Runs
    # ------------------------------------------------------------------

    def run_for_decision(
        self,
        *,
        decision_id: UUID,
        policies: list[Policy] | None = None,
        config_path: str | Path | None = None,
        actor_agent_id: UUID | None = None,
    ) -> list[PolicyResult]:
        """Run the configured policies against `decision_id` and persist results.

        Resolution of which policies to run, in priority order:

        1. The explicit `policies` argument.
        2. `config_path` (TOML file) loaded via `load_policy_specs`.
        3. The default registry (every default policy enabled at MEDIUM).
        """
        decision = self.session.get(Decision, decision_id)
        if decision is None:
            raise NotFoundError(f"decision not found: {decision_id}")

        if policies is None:
            specs = load_policy_specs(config_path)
            self.sync_policies(specs)
            policies_to_run = instantiate_enabled(specs)
        else:
            policies_to_run = policies
            # Best-effort sync so PolicyResult rows can FK to a real Policy row
            specs = [
                PolicySpec(
                    name=p.name,
                    cls=DEFAULT_POLICIES_BY_NAME.get(p.name, type(p)),
                    enabled=True,
                    severity=p.severity,
                    config=p.config,
                )
                for p in policies_to_run
            ]
            self.sync_policies(specs)

        git_change = self._latest_git_change(decision.id)
        diff_text = self._diff_text_for(git_change)
        ctx = PolicyContext(
            decision=decision,
            git_change=git_change,
            diff_text=diff_text,
        )

        outcomes = run_policies(policies_to_run, ctx)
        rows = self._persist_outcomes(decision=decision, outcomes=outcomes)

        self.events.log(
            project_id=decision.project_id,
            entity_type="decision",
            entity_id=decision.id,
            event_type="decision.policy_evaluated",
            actor_agent_id=actor_agent_id,
            payload={
                "policy_count": len(outcomes),
                "blocked": sum(1 for o in outcomes if o.verdict.status.value == "blocked"),
                "warnings": sum(1 for o in outcomes if o.verdict.status.value == "warning"),
                "results": [
                    {
                        "policy": o.policy.name,
                        "status": o.verdict.status.value,
                        "message": o.verdict.message,
                    }
                    for o in outcomes
                ],
            },
        )
        return rows

    def list_for_decision(self, decision_id: UUID) -> list[PolicyResult]:
        return (
            self.session.query(PolicyResult)
            .filter(PolicyResult.decision_id == decision_id)
            .order_by(PolicyResult.created_at.asc())
            .all()
        )

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _persist_outcomes(
        self,
        *,
        decision: Decision,
        outcomes: list[PolicyOutcome],
    ) -> list[PolicyResult]:
        rows: list[PolicyResult] = []
        for outcome in outcomes:
            policy_row = (
                self.session.query(PolicyRow)
                .filter(PolicyRow.name == outcome.policy.name)
                .one_or_none()
            )
            if policy_row is None:
                # Sync was best-effort — create a minimal row now to satisfy FK
                policy_row = PolicyRow(
                    name=outcome.policy.name,
                    description=outcome.policy.description,
                    enabled=True,
                    severity=outcome.policy.severity,
                    config_json=dict(outcome.policy.config),
                )
                self.session.add(policy_row)
                self.session.flush()
            row = PolicyResult(
                decision_id=decision.id,
                policy_id=policy_row.id,
                status=outcome.verdict.status,
                message=outcome.verdict.message,
                evidence_json=dict(outcome.verdict.evidence),
            )
            self.session.add(row)
            rows.append(row)
        self.session.flush()
        return rows


__all__ = ["PolicyService"]
