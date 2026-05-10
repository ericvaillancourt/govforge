"""Enums shared across the domain layer.

Stored in DB as VARCHAR via SQLAlchemy `Enum(...)`. Values are intentionally
lowercase strings so they're stable in JSON exports and audit logs — never
rename a variant once data exists for it; add a new one and migrate instead.
"""

from enum import StrEnum


class RiskLevel(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TaskStatus(StrEnum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    REVIEW_REQUIRED = "review_required"
    APPROVED = "approved"
    REJECTED = "rejected"
    CLOSED = "closed"


class DecisionStatus(StrEnum):
    DRAFT = "draft"
    REVIEW_REQUIRED = "review_required"
    CHANGES_REQUESTED = "changes_requested"
    APPROVED = "approved"
    REJECTED = "rejected"


class ReviewStatus(StrEnum):
    APPROVED = "approved"
    CHANGES_REQUESTED = "changes_requested"
    COMMENTED = "commented"
    REJECTED = "rejected"


class FindingSeverity(StrEnum):
    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class FindingCategory(StrEnum):
    SECURITY = "security"
    PERFORMANCE = "performance"
    ARCHITECTURE = "architecture"
    BUG = "bug"
    MAINTAINABILITY = "maintainability"
    TESTS = "tests"


class PolicyResultStatus(StrEnum):
    PASSED = "passed"
    WARNING = "warning"
    BLOCKED = "blocked"


class ApprovalStatus(StrEnum):
    APPROVED = "approved"
    REJECTED = "rejected"
    NEEDS_CHANGES = "needs_changes"


class AgentType(StrEnum):
    HUMAN = "human"
    CLAUDE = "claude"
    CODEX = "codex"
    CURSOR = "cursor"
    CLINE = "cline"
    AIDER = "aider"
    OTHER = "other"
