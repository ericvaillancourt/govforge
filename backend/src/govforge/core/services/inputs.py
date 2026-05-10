"""Input dataclasses for service methods.

These are intentionally minimal — they exist so that callers (API, MCP) can
build them from validated Pydantic models and pass them through to services
without forcing the service layer to depend on Pydantic.
"""

from __future__ import annotations

from dataclasses import dataclass

from govforge.core.enums import FindingCategory, FindingSeverity


@dataclass(frozen=True)
class FindingInput:
    """Input for a single review finding (passed to ReviewService.submit)."""

    severity: FindingSeverity
    category: FindingCategory
    message: str
    file_path: str | None = None
    line_start: int | None = None
    line_end: int | None = None
    recommendation: str | None = None
