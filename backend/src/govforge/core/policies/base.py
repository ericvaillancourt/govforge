"""Policy abstract base + verdict types.

A `Policy` is a pure function over `(Decision, GitChange | None)`. It returns
either a `PolicyVerdict` (passed / warning / blocked) or `None` if the policy
doesn't apply (e.g. no GitChange attached, or no high-risk flag set).

Policies do NOT touch the DB themselves. The runner collects verdicts and
`PolicyService` is responsible for persistence and event emission.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import ClassVar

from govforge.core.enums import FindingSeverity, PolicyResultStatus
from govforge.core.models import Decision, GitChange


@dataclass(frozen=True)
class PolicyContext:
    """Everything a policy needs to evaluate a decision.

    `diff_text` is the unified diff for the attached commit. The runner
    populates it from the Git extractor so policies stay pure (no Git I/O
    in the policy itself, easier to unit-test).
    """

    decision: Decision
    git_change: GitChange | None = None
    diff_text: str | None = None


@dataclass(frozen=True)
class PolicyVerdict:
    """A policy's judgement on a single decision."""

    status: PolicyResultStatus
    message: str
    evidence: dict[str, object] = field(default_factory=dict)


class Policy(ABC):
    """Abstract base for all policies.

    Subclasses set `name` / `description` as class vars and implement
    `evaluate`. The runtime config (enabled, severity, patterns, thresholds)
    is supplied at instantiation time so the same class can be loaded with
    different settings per project.
    """

    name: ClassVar[str]
    description: ClassVar[str]

    def __init__(
        self,
        *,
        severity: FindingSeverity = FindingSeverity.MEDIUM,
        config: dict[str, object] | None = None,
    ) -> None:
        self.severity = severity
        self.config = dict(config or {})

    @abstractmethod
    def evaluate(self, ctx: PolicyContext) -> PolicyVerdict | None:
        """Return a verdict, or None if the policy doesn't apply to this decision."""


__all__ = [
    "Policy",
    "PolicyContext",
    "PolicyVerdict",
]
