"""Load policy configuration from `.govforge/policies.toml`.

Format (devis.md §15.3)::

    [auth_change_requires_review]
    enabled = true
    severity = "high"
    patterns = ["auth", "session", "jwt", "permission", "middleware"]

    [large_diff_requires_human_approval]
    enabled = true
    severity = "medium"
    max_lines_changed = 500

Sections name a policy class registered in
`govforge.core.policies.defaults.DEFAULT_POLICIES_BY_NAME`. Unknown sections
are reported but do not raise — that lets the engine evolve without breaking
old config files.
"""

from __future__ import annotations

import tomllib
from dataclasses import dataclass
from pathlib import Path

from govforge.core.enums import FindingSeverity
from govforge.core.policies.base import Policy
from govforge.core.policies.defaults import DEFAULT_POLICIES_BY_NAME


class PolicyConfigError(Exception):
    """Raised when a policy config file is malformed."""


@dataclass(frozen=True)
class PolicySpec:
    """A policy ready to instantiate: class + runtime config."""

    name: str
    cls: type[Policy]
    enabled: bool
    severity: FindingSeverity
    config: dict[str, object]

    def instantiate(self) -> Policy:
        return self.cls(severity=self.severity, config=self.config)


def _coerce_severity(raw: object, default: FindingSeverity) -> FindingSeverity:
    if raw is None:
        return default
    if isinstance(raw, str):
        try:
            return FindingSeverity(raw.lower())
        except ValueError as e:
            raise PolicyConfigError(f"unknown severity: {raw!r}") from e
    raise PolicyConfigError(f"severity must be a string, got {type(raw).__name__}")


def parse_policy_config(
    raw: dict[str, object],
    *,
    registry: dict[str, type[Policy]] | None = None,
) -> list[PolicySpec]:
    """Turn parsed TOML into a list of PolicySpec.

    Sections with `enabled = false` are still returned (with `enabled=False`)
    so callers can present a complete picture. Unknown sections are skipped
    silently.
    """
    reg = registry if registry is not None else DEFAULT_POLICIES_BY_NAME
    specs: list[PolicySpec] = []
    for name, value in raw.items():
        if not isinstance(value, dict):
            continue
        cls = reg.get(name)
        if cls is None:
            continue
        section = dict(value)
        enabled = bool(section.pop("enabled", True))
        severity = _coerce_severity(section.pop("severity", None), FindingSeverity.MEDIUM)
        specs.append(
            PolicySpec(
                name=name,
                cls=cls,
                enabled=enabled,
                severity=severity,
                config=section,
            )
        )
    return specs


def load_policy_specs(
    config_path: str | Path | None,
    *,
    registry: dict[str, type[Policy]] | None = None,
) -> list[PolicySpec]:
    """Load policy specs from `config_path`, or return defaults if file is absent.

    Default behaviour: every registered policy is enabled with `severity=MEDIUM`
    and an empty config dict (the policy classes carry their own DEFAULT_*).
    """
    reg = registry if registry is not None else DEFAULT_POLICIES_BY_NAME
    if config_path is not None:
        path = Path(config_path)
        if path.exists():
            try:
                with path.open("rb") as fh:
                    raw = tomllib.load(fh)
            except tomllib.TOMLDecodeError as e:
                raise PolicyConfigError(f"invalid TOML in {path}: {e}") from e
            return parse_policy_config(raw, registry=reg)
    # No file → enable every default at MEDIUM severity with empty config
    return [
        PolicySpec(
            name=name,
            cls=cls,
            enabled=True,
            severity=FindingSeverity.MEDIUM,
            config={},
        )
        for name, cls in reg.items()
    ]


def instantiate_enabled(specs: list[PolicySpec]) -> list[Policy]:
    """Convenience: keep only enabled specs and instantiate them."""
    return [spec.instantiate() for spec in specs if spec.enabled]


__all__ = [
    "PolicyConfigError",
    "PolicySpec",
    "instantiate_enabled",
    "load_policy_specs",
    "parse_policy_config",
]
