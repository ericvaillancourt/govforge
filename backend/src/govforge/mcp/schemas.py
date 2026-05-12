"""Pydantic input/output schemas for the MCP tools.

These match the JSON shapes documented in `devis.md` §10.2. Keeping them in
one module makes the public contract auditable in a single read.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from govforge.core.enums import (
    ApprovalStatus,
    FindingCategory,
    FindingSeverity,
    PolicyResultStatus,
    ReviewStatus,
    RiskLevel,
)


class _Strict(BaseModel):
    """Reject unknown keys so a typo in tool input fails loudly."""

    model_config = ConfigDict(extra="forbid")


# ---------------------------------------------------------------------------
# create_task
# ---------------------------------------------------------------------------


class CreateTaskInput(_Strict):
    project_path: str
    title: str
    description: str | None = None
    risk_level: RiskLevel = RiskLevel.MEDIUM
    actor_agent: str | None = None


class CreateTaskOutput(_Strict):
    task_id: str
    status: str


# ---------------------------------------------------------------------------
# record_decision
# ---------------------------------------------------------------------------


class RecordDecisionInput(_Strict):
    task_id: str
    author_agent: str
    title: str
    summary: str | None = None
    rationale: str | None = None
    risk_level: RiskLevel = RiskLevel.MEDIUM
    human_approval_required: bool = False


class RecordDecisionOutput(_Strict):
    decision_id: str
    status: str


# ---------------------------------------------------------------------------
# attach_git_diff
# ---------------------------------------------------------------------------


class AttachGitDiffInput(_Strict):
    decision_id: str
    repo_path: str
    commit_hash: str = "HEAD"
    actor_agent: str | None = None


class AttachGitDiffOutput(_Strict):
    decision_id: str
    files_changed: list[str]
    insertions: int
    deletions: int
    diff_hash: str


# ---------------------------------------------------------------------------
# run_policy_checks
# ---------------------------------------------------------------------------


class RunPolicyChecksInput(_Strict):
    decision_id: str
    config_path: str | None = None
    actor_agent: str | None = None


class PolicyResultEntry(_Strict):
    policy: str
    status: PolicyResultStatus
    message: str


class RunPolicyChecksOutput(_Strict):
    decision_status: str
    results: list[PolicyResultEntry]


# ---------------------------------------------------------------------------
# request_review / submit_review
# ---------------------------------------------------------------------------


class RequestReviewInput(_Strict):
    decision_id: str
    reviewer_agent: str
    focus: list[str] = Field(default_factory=list)
    actor_agent: str | None = None


class RequestReviewOutput(_Strict):
    decision_id: str
    status: str


class SubmitReviewFinding(_Strict):
    severity: FindingSeverity = Field(
        description=(
            "Severity of the finding. One of: info, low, medium, high, critical."
        ),
    )
    category: FindingCategory = Field(
        description=(
            "Category of the finding. One of: security, performance, architecture, "
            "bug, maintainability, tests, docs, accessibility."
        ),
    )
    file_path: str | None = None
    line_start: int | None = None
    line_end: int | None = None
    message: str
    recommendation: str | None = None


class SubmitReviewInput(_Strict):
    decision_id: str
    reviewer_agent: str
    status: ReviewStatus
    summary: str | None = None
    findings: list[SubmitReviewFinding] = Field(default_factory=list)


class SubmitReviewOutput(_Strict):
    review_id: str
    decision_id: str
    decision_status: str


# ---------------------------------------------------------------------------
# record_disagreement
# ---------------------------------------------------------------------------


class RecordDisagreementInput(_Strict):
    decision_id: str
    topic: str
    author_position: str | None = None
    reviewer_position: str | None = None
    risk_summary: str | None = None
    requires_human_decision: bool = True
    actor_agent: str | None = None


class RecordDisagreementOutput(_Strict):
    disagreement_id: str
    decision_id: str
    requires_human_decision: bool


# ---------------------------------------------------------------------------
# approve_decision
# ---------------------------------------------------------------------------


class ApproveDecisionInput(_Strict):
    decision_id: str
    approver: str
    status: ApprovalStatus
    comment: str | None = None


class ApproveDecisionOutput(_Strict):
    decision_id: str
    decision_status: str
    approval_status: str


# ---------------------------------------------------------------------------
# get_decision_context
# ---------------------------------------------------------------------------


class GetDecisionContextInput(_Strict):
    decision_id: str


class GetDecisionContextOutput(_Strict):
    decision: dict[str, Any]
    git_change: dict[str, Any] | None
    reviews: list[dict[str, Any]]
    policy_results: list[dict[str, Any]]
    disagreements: list[dict[str, Any]]
    approvals: list[dict[str, Any]]
    events: list[dict[str, Any]]


# ---------------------------------------------------------------------------
# list_open_reviews / list_pending_approvals
# ---------------------------------------------------------------------------


class ListOpenReviewsInput(_Strict):
    project_path: str


class OpenReviewEntry(_Strict):
    review_id: str
    decision_id: str
    reviewer_agent: str
    status: str


class ListOpenReviewsOutput(_Strict):
    reviews: list[OpenReviewEntry]


class ListPendingApprovalsInput(_Strict):
    project_path: str


class PendingApprovalEntry(_Strict):
    decision_id: str
    title: str
    risk_level: str
    status: str


class ListPendingApprovalsOutput(_Strict):
    decisions: list[PendingApprovalEntry]


__all__ = [
    "ApproveDecisionInput",
    "ApproveDecisionOutput",
    "AttachGitDiffInput",
    "AttachGitDiffOutput",
    "CreateTaskInput",
    "CreateTaskOutput",
    "GetDecisionContextInput",
    "GetDecisionContextOutput",
    "ListOpenReviewsInput",
    "ListOpenReviewsOutput",
    "ListPendingApprovalsInput",
    "ListPendingApprovalsOutput",
    "OpenReviewEntry",
    "PendingApprovalEntry",
    "PolicyResultEntry",
    "RecordDecisionInput",
    "RecordDecisionOutput",
    "RecordDisagreementInput",
    "RecordDisagreementOutput",
    "RequestReviewInput",
    "RequestReviewOutput",
    "RunPolicyChecksInput",
    "RunPolicyChecksOutput",
    "SubmitReviewFinding",
    "SubmitReviewInput",
    "SubmitReviewOutput",
]
