"""Policy engine — evaluate decisions against a configurable rule set.

Layout:
- `base`     : Policy ABC, PolicyContext, PolicyVerdict
- `defaults` : the 5 default policies + registry
- `loader`   : TOML config parser
- `runner`   : pure evaluation loop (no DB)

`govforge.core.services.policy_service` wires this to the database.
"""

from govforge.core.policies.base import Policy, PolicyContext, PolicyVerdict
from govforge.core.policies.defaults import (
    DEFAULT_POLICIES_BY_NAME,
    DEFAULT_POLICY_CLASSES,
    AuthChangeRequiresReview,
    LargeDiffRequiresHumanApproval,
    MigrationRequiresReview,
    SecretPatternDetection,
    TestRequiredForHighRisk,
)
from govforge.core.policies.loader import (
    PolicyConfigError,
    PolicySpec,
    instantiate_enabled,
    load_policy_specs,
    parse_policy_config,
)
from govforge.core.policies.runner import PolicyOutcome, run_policies

__all__ = [
    "DEFAULT_POLICIES_BY_NAME",
    "DEFAULT_POLICY_CLASSES",
    "AuthChangeRequiresReview",
    "LargeDiffRequiresHumanApproval",
    "MigrationRequiresReview",
    "Policy",
    "PolicyConfigError",
    "PolicyContext",
    "PolicyOutcome",
    "PolicySpec",
    "PolicyVerdict",
    "SecretPatternDetection",
    "TestRequiredForHighRisk",
    "instantiate_enabled",
    "load_policy_specs",
    "parse_policy_config",
    "run_policies",
]
