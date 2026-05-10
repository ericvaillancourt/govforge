"""Default policies shipped with GovForge.

These cover the five "demonstrative-but-simple" cases listed in `devis.md`
§15.2. They run on filename patterns and (where needed) the unified diff
text. None of them touch the network, file system, or database.
"""

from __future__ import annotations

import re
from typing import ClassVar

from govforge.core.enums import PolicyResultStatus, RiskLevel
from govforge.core.policies.base import Policy, PolicyContext, PolicyVerdict


def _str_list(raw: object, default: list[str]) -> list[str]:
    """Coerce a TOML config value into a list of strings, falling back to default."""
    if isinstance(raw, list) and all(isinstance(x, str) for x in raw):
        return list(raw)
    return list(default)


def _int(raw: object, default: int) -> int:
    if isinstance(raw, int) and not isinstance(raw, bool):
        return raw
    return default


# ---------------------------------------------------------------------------
# 1. auth_change_requires_review
# ---------------------------------------------------------------------------


class AuthChangeRequiresReview(Policy):
    """Block decisions that touch auth-adjacent files until a review is recorded."""

    name: ClassVar[str] = "auth_change_requires_review"
    description: ClassVar[str] = (
        "Files matching auth-adjacent patterns require a review before approval."
    )
    DEFAULT_PATTERNS: ClassVar[list[str]] = [
        "auth",
        "session",
        "jwt",
        "permission",
        "middleware",
    ]

    def evaluate(self, ctx: PolicyContext) -> PolicyVerdict | None:
        if ctx.git_change is None:
            return None
        patterns = _str_list(self.config.get("patterns"), self.DEFAULT_PATTERNS)
        files = list(ctx.git_change.files_changed_json or [])
        matched = [f for f in files if any(p.lower() in f.lower() for p in patterns)]
        if not matched:
            return PolicyVerdict(
                status=PolicyResultStatus.PASSED,
                message="No auth-adjacent files modified.",
                evidence={"patterns": patterns},
            )
        return PolicyVerdict(
            status=PolicyResultStatus.BLOCKED,
            message=f"{len(matched)} auth-adjacent file(s) modified — review required.",
            evidence={"matched_files": matched, "patterns": patterns},
        )


# ---------------------------------------------------------------------------
# 2. secret_pattern_detection
# ---------------------------------------------------------------------------


class SecretPatternDetection(Policy):
    """Flag commits that look like they introduce credentials.

    Two signal sources:
      - filenames matching `.env` (warning — legit `.env.example` files trip
        this, hence not blocked)
      - diff content matching one of the high-confidence secret patterns
        (BLOCKED)
    """

    name: ClassVar[str] = "secret_pattern_detection"
    description: ClassVar[str] = "Detect leaked credentials in filenames or diff content."
    DEFAULT_FILE_PATTERNS: ClassVar[list[str]] = [".env"]
    DEFAULT_CONTENT_PATTERNS: ClassVar[list[str]] = [
        "AWS_SECRET_ACCESS_KEY",
        "PRIVATE_KEY",
        "password=",
        "api_key=",
    ]

    def evaluate(self, ctx: PolicyContext) -> PolicyVerdict | None:
        if ctx.git_change is None:
            return None
        file_patterns = _str_list(self.config.get("file_patterns"), self.DEFAULT_FILE_PATTERNS)
        content_patterns = _str_list(
            self.config.get("content_patterns"), self.DEFAULT_CONTENT_PATTERNS
        )
        files = list(ctx.git_change.files_changed_json or [])
        matched_files = [f for f in files if any(p.lower() in f.lower() for p in file_patterns)]

        matched_content: list[str] = []
        if ctx.diff_text:
            for pat in content_patterns:
                if pat.lower() in ctx.diff_text.lower():
                    matched_content.append(pat)

        if matched_content:
            return PolicyVerdict(
                status=PolicyResultStatus.BLOCKED,
                message=(f"{len(matched_content)} secret pattern(s) detected in diff content."),
                evidence={
                    "matched_content_patterns": matched_content,
                    "matched_files": matched_files,
                },
            )
        if matched_files:
            return PolicyVerdict(
                status=PolicyResultStatus.WARNING,
                message=f"{len(matched_files)} env-like file(s) touched — verify no secrets leaked.",
                evidence={"matched_files": matched_files},
            )
        return PolicyVerdict(
            status=PolicyResultStatus.PASSED,
            message="No secret patterns detected.",
            evidence={
                "file_patterns": file_patterns,
                "content_patterns": content_patterns,
            },
        )


# ---------------------------------------------------------------------------
# 3. test_required_for_high_risk
# ---------------------------------------------------------------------------


_TEST_PATH_RE = re.compile(r"(^|/)(tests?|__tests__|test_[^/]+\.py|.+\.test\.[a-z]+)(/|$)")


class TestRequiredForHighRisk(Policy):
    """When risk is HIGH or CRITICAL, require at least one test file in the diff."""

    __test__ = False  # Tell pytest not to try to collect this as a test class.

    name: ClassVar[str] = "test_required_for_high_risk"
    description: ClassVar[str] = (
        "High-risk decisions must include at least one test file in the diff."
    )

    def evaluate(self, ctx: PolicyContext) -> PolicyVerdict | None:
        if ctx.decision.risk_level not in (RiskLevel.HIGH, RiskLevel.CRITICAL):
            return None
        if ctx.git_change is None:
            return None
        files = list(ctx.git_change.files_changed_json or [])
        test_files = [f for f in files if _TEST_PATH_RE.search(f)]
        if test_files:
            return PolicyVerdict(
                status=PolicyResultStatus.PASSED,
                message=f"{len(test_files)} test file(s) modified.",
                evidence={"test_files": test_files},
            )
        return PolicyVerdict(
            status=PolicyResultStatus.WARNING,
            message=(f"Risk={ctx.decision.risk_level.value} but no test files modified."),
            evidence={"risk_level": ctx.decision.risk_level.value, "files_changed": files},
        )


# ---------------------------------------------------------------------------
# 4. migration_requires_review
# ---------------------------------------------------------------------------


_MIGRATION_PATH_RE = re.compile(
    r"(^|/)(migrations?|alembic/versions)/.+\.(py|sql)$",
    re.IGNORECASE,
)


class MigrationRequiresReview(Policy):
    """Detect DB migration files; require review before approval."""

    name: ClassVar[str] = "migration_requires_review"
    description: ClassVar[str] = "DB migration files trigger a mandatory review."

    def evaluate(self, ctx: PolicyContext) -> PolicyVerdict | None:
        if ctx.git_change is None:
            return None
        files = list(ctx.git_change.files_changed_json or [])
        migrations = [f for f in files if _MIGRATION_PATH_RE.search(f)]
        if not migrations:
            return PolicyVerdict(
                status=PolicyResultStatus.PASSED,
                message="No migration files touched.",
            )
        return PolicyVerdict(
            status=PolicyResultStatus.BLOCKED,
            message=f"{len(migrations)} migration file(s) require review.",
            evidence={"migration_files": migrations},
        )


# ---------------------------------------------------------------------------
# 5. large_diff_requires_human_approval
# ---------------------------------------------------------------------------


class LargeDiffRequiresHumanApproval(Policy):
    """Diffs above a configurable line count require explicit human approval."""

    name: ClassVar[str] = "large_diff_requires_human_approval"
    description: ClassVar[str] = (
        "Decisions whose diff exceeds the line threshold require human approval."
    )
    DEFAULT_MAX_LINES: ClassVar[int] = 500

    def evaluate(self, ctx: PolicyContext) -> PolicyVerdict | None:
        if ctx.git_change is None:
            return None
        max_lines = _int(self.config.get("max_lines_changed"), self.DEFAULT_MAX_LINES)
        total = (ctx.git_change.insertions or 0) + (ctx.git_change.deletions or 0)
        if total <= max_lines:
            return PolicyVerdict(
                status=PolicyResultStatus.PASSED,
                message=f"Diff size {total} within threshold ({max_lines}).",
                evidence={"total_lines": total, "max_lines": max_lines},
            )
        return PolicyVerdict(
            status=PolicyResultStatus.BLOCKED,
            message=f"Diff size {total} exceeds threshold ({max_lines}) — human approval required.",
            evidence={"total_lines": total, "max_lines": max_lines},
        )


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------


DEFAULT_POLICY_CLASSES: list[type[Policy]] = [
    AuthChangeRequiresReview,
    SecretPatternDetection,
    TestRequiredForHighRisk,
    MigrationRequiresReview,
    LargeDiffRequiresHumanApproval,
]


DEFAULT_POLICIES_BY_NAME: dict[str, type[Policy]] = {
    cls.name: cls for cls in DEFAULT_POLICY_CLASSES
}


__all__ = [
    "DEFAULT_POLICIES_BY_NAME",
    "DEFAULT_POLICY_CLASSES",
    "AuthChangeRequiresReview",
    "LargeDiffRequiresHumanApproval",
    "MigrationRequiresReview",
    "SecretPatternDetection",
    "TestRequiredForHighRisk",
]
