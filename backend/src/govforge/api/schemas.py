"""Pydantic schemas for the HTTP API.

Response models mirror what the CLI and the local UI expect to consume.
Request models reject extra keys so a typo fails with HTTP 422 rather
than silently dropping the field.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from govforge.core.enums import (
    AgentType,
    ApprovalStatus,
    DecisionStatus,
    FindingCategory,
    FindingSeverity,
    PolicyResultStatus,
    ReviewStatus,
    RiskLevel,
    TaskStatus,
    TokenScope,
)


class _Strict(BaseModel):
    """Reject unknown keys. Used for request bodies."""

    model_config = ConfigDict(extra="forbid")


class _ORM(BaseModel):
    """Permissive base for ORM-derived response models."""

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


class HealthOut(BaseModel):
    status: str
    version: str


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------


class ProjectIn(_Strict):
    name: str
    root_path: str
    default_branch: str = "main"


class ProjectOut(_ORM):
    id: UUID
    name: str
    root_path: str
    default_branch: str
    created_at: datetime


# ---------------------------------------------------------------------------
# Agents (used embedded in other responses)
# ---------------------------------------------------------------------------


class AgentOut(_ORM):
    id: UUID
    name: str
    type: AgentType


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------


class TaskIn(_Strict):
    project_path: str
    title: str
    description: str | None = None
    risk_level: RiskLevel = RiskLevel.MEDIUM
    actor_agent: str | None = None


class TaskOut(_ORM):
    id: UUID
    display_id: str
    project_id: UUID
    title: str
    description: str | None
    risk_level: RiskLevel
    status: TaskStatus
    created_at: datetime


# ---------------------------------------------------------------------------
# Decisions
# ---------------------------------------------------------------------------


class DecisionIn(_Strict):
    task_id: str
    author_agent: str
    title: str
    summary: str | None = None
    rationale: str | None = None
    risk_level: RiskLevel = RiskLevel.MEDIUM
    human_approval_required: bool = False


class DecisionOut(_ORM):
    id: UUID
    display_id: str
    project_id: UUID
    task_id: UUID | None
    title: str
    summary: str | None
    rationale: str | None
    status: DecisionStatus
    risk_level: RiskLevel
    human_approval_required: bool
    created_at: datetime


class AttachGitIn(_Strict):
    repo_path: str
    commit_hash: str = "HEAD"
    actor_agent: str | None = None


class GitChangeOut(_ORM):
    id: UUID
    decision_id: UUID
    repo_path: str
    branch_name: str | None
    commit_hash: str
    parent_commit_hash: str | None
    diff_hash: str
    files_changed_json: list[str] = Field(default_factory=list, alias="files_changed_json")
    insertions: int
    deletions: int


class ApprovalIn(_Strict):
    approver: str
    comment: str | None = None


class ApprovalOut(_ORM):
    id: UUID
    decision_id: UUID
    status: ApprovalStatus
    comment: str | None
    created_at: datetime


# ---------------------------------------------------------------------------
# Reviews
# ---------------------------------------------------------------------------


class ReviewRequestIn(_Strict):
    decision_id: str
    reviewer_agent: str
    focus: list[str] = Field(default_factory=list)
    actor_agent: str | None = None


class FindingIn(_Strict):
    severity: FindingSeverity
    category: FindingCategory
    file_path: str | None = None
    line_start: int | None = None
    line_end: int | None = None
    message: str
    recommendation: str | None = None


class ReviewSubmitIn(_Strict):
    decision_id: str
    reviewer_agent: str
    status: ReviewStatus
    summary: str | None = None
    findings: list[FindingIn] = Field(default_factory=list)


class FindingOut(_ORM):
    id: UUID
    severity: FindingSeverity
    category: FindingCategory
    file_path: str | None
    line_start: int | None
    line_end: int | None
    message: str
    recommendation: str | None


class ReviewOut(_ORM):
    id: UUID
    display_id: str
    decision_id: UUID
    reviewer_agent_id: UUID
    status: ReviewStatus
    summary: str | None
    created_at: datetime
    findings: list[FindingOut] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Disagreements
# ---------------------------------------------------------------------------


class DisagreementRecordIn(_Strict):
    decision_id: str
    topic: str
    author_position: str | None = None
    reviewer_position: str | None = None
    risk_summary: str | None = None
    requires_human_decision: bool = True
    actor_agent: str | None = None


class DisagreementOut(_ORM):
    id: UUID
    decision_id: UUID
    topic: str
    author_position: str | None
    reviewer_position: str | None
    risk_summary: str | None
    requires_human_decision: bool
    resolution: str | None
    resolved_by_agent_id: UUID | None
    resolved_at: datetime | None
    created_at: datetime


# ---------------------------------------------------------------------------
# Policies
# ---------------------------------------------------------------------------


class PolicyOut(_ORM):
    id: UUID
    name: str
    description: str | None
    enabled: bool
    severity: FindingSeverity
    config_json: dict[str, Any] | None


class PolicyCheckIn(_Strict):
    decision_id: str
    config_path: str | None = None
    actor_agent: str | None = None


class PolicyResultOut(_ORM):
    id: UUID
    decision_id: UUID
    policy_id: UUID
    status: PolicyResultStatus
    message: str | None
    evidence_json: dict[str, Any] | None
    created_at: datetime


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------


class EventOut(_ORM):
    id: UUID
    project_id: UUID
    entity_type: str
    entity_id: UUID
    event_type: str
    actor_agent_id: UUID | None
    payload_json: dict[str, Any] | None
    created_at: datetime


__all__ = [
    "AgentOut",
    "ApiTokenCreateIn",
    "ApiTokenCreateOut",
    "ApiTokenOut",
    "ApprovalIn",
    "ApprovalOut",
    "AttachGitIn",
    "DecisionIn",
    "DecisionOut",
    "DisagreementOut",
    "DisagreementRecordIn",
    "EventOut",
    "FindingIn",
    "FindingOut",
    "GitChangeOut",
    "HealthOut",
    "PolicyCheckIn",
    "PolicyOut",
    "PolicyResultOut",
    "ProjectIn",
    "ProjectOut",
    "ReviewOut",
    "ReviewRequestIn",
    "ReviewSubmitIn",
    "TaskIn",
    "TaskOut",
]


# ---------------------------------------------------------------------------
# API tokens (Phase 3.0 Stage A)
# ---------------------------------------------------------------------------


class ApiTokenCreateIn(_Strict):
    """Request body for POST /tokens."""

    label: str = Field(min_length=1, max_length=255)
    agent_type: AgentType
    scopes: list[TokenScope] = Field(min_length=1)
    expires_in_days: int | None = Field(default=None, ge=1, le=3650)


class ApiTokenOut(_ORM):
    """Token metadata WITHOUT the secret. Used by GET /tokens and after creation."""

    id: UUID
    label: str
    agent_type: AgentType
    prefix: str
    scopes_csv: str
    created_at: datetime
    last_used_at: datetime | None
    expires_at: datetime | None
    revoked_at: datetime | None


class ApiTokenCreateOut(BaseModel):
    """POST /tokens response: includes the plaintext secret ONCE."""

    model_config = ConfigDict(from_attributes=False)

    token: ApiTokenOut
    secret: str = Field(
        description=(
            "Full plaintext token. Only returned at creation time — store it "
            "securely; it cannot be recovered."
        )
    )
