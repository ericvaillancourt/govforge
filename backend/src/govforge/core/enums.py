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


class AuthProvider(StrEnum):
    """OAuth / passwordless providers backing a user account."""

    GITHUB = "github"
    GOOGLE = "google"
    MAGIC_LINK = "magic_link"


class TokenScope(StrEnum):
    """API-token capability scopes. `<resource>:<action>` convention.

    `admin` is special: a token holding `admin` is treated as if it held every
    other scope. Tokens are issued with an explicit list; the auth dependency
    checks the requested scope is in the list (or `admin` is).
    """

    PROJECTS_READ = "projects:read"
    PROJECTS_WRITE = "projects:write"
    TASKS_READ = "tasks:read"
    TASKS_WRITE = "tasks:write"
    DECISIONS_READ = "decisions:read"
    DECISIONS_WRITE = "decisions:write"
    REVIEWS_READ = "reviews:read"
    REVIEWS_WRITE = "reviews:write"
    POLICIES_READ = "policies:read"
    POLICIES_WRITE = "policies:write"
    EVENTS_READ = "events:read"
    TOKENS_READ = "tokens:read"
    TOKENS_WRITE = "tokens:write"
    ADMIN = "admin"
