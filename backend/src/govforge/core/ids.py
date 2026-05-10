"""Display ID helpers (`TASK-001`, `DEC-042`, ...).

Every primary entity has two identifiers:

- `id` — UUID, primary key, used internally and in API payloads
- `display_id` — short human-friendly string, scoped per project, used in CLI
  output, audit logs, and external references

Display IDs are generated server-side at insert time. They have a strict
format: `<PREFIX>-<NNN>` where NNN is zero-padded to at least 3 digits but
may grow as needed (TASK-1234 is fine).
"""

from __future__ import annotations

PREFIX_TASK = "TASK"
PREFIX_DECISION = "DEC"
PREFIX_REVIEW = "REV"
PREFIX_FINDING = "FND"
PREFIX_DISAGREEMENT = "DIS"
PREFIX_APPROVAL = "APR"
PREFIX_POLICY_RESULT = "POL"
PREFIX_EVENT = "EVT"


def format_display_id(prefix: str, sequence: int) -> str:
    """Format a sequence number into a display ID.

    >>> format_display_id("TASK", 1)
    'TASK-001'
    >>> format_display_id("DEC", 42)
    'DEC-042'
    >>> format_display_id("REV", 1234)
    'REV-1234'
    """
    if sequence < 1:
        raise ValueError(f"sequence must be >= 1, got {sequence}")
    return f"{prefix}-{sequence:03d}"


def parse_display_id(display_id: str) -> tuple[str, int]:
    """Parse a display ID into (prefix, sequence).

    >>> parse_display_id("TASK-001")
    ('TASK', 1)
    >>> parse_display_id("DEC-042")
    ('DEC', 42)
    """
    try:
        prefix, raw_seq = display_id.rsplit("-", 1)
        return prefix, int(raw_seq)
    except (ValueError, IndexError) as e:
        raise ValueError(f"invalid display_id format: {display_id!r}") from e
