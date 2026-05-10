# Authoring a Custom Policy

The five default policies are simple subclasses of `Policy`. Writing a
new one is a four-step process.

## 1. Subclass `Policy`

Add your class to
[`backend/src/govforge/core/policies/defaults.py`](../backend/src/govforge/core/policies/defaults.py)
(or a separate module if you'd rather keep it isolated).

```python
from typing import ClassVar
from govforge.core.enums import PolicyResultStatus
from govforge.core.policies.base import Policy, PolicyContext, PolicyVerdict


class NoTodoInProductionFiles(Policy):
    """Block decisions that introduce TODO/FIXME comments in non-test code."""

    name: ClassVar[str] = "no_todo_in_production_files"
    description: ClassVar[str] = (
        "Diff content matches TODO/FIXME outside test paths."
    )
    DEFAULT_MARKERS: ClassVar[list[str]] = ["TODO", "FIXME", "XXX"]

    def evaluate(self, ctx: PolicyContext) -> PolicyVerdict | None:
        if ctx.git_change is None or not ctx.diff_text:
            return None  # Skip — no diff to inspect

        markers = self.config.get("markers", self.DEFAULT_MARKERS)
        files = list(ctx.git_change.files_changed_json or [])
        non_test_files = [f for f in files if "test" not in f.lower()]
        if not non_test_files:
            return PolicyVerdict(
                status=PolicyResultStatus.PASSED,
                message="No production files modified.",
            )

        hits = [m for m in markers if m in ctx.diff_text]
        if not hits:
            return PolicyVerdict(
                status=PolicyResultStatus.PASSED,
                message="No TODO/FIXME markers in diff.",
            )

        return PolicyVerdict(
            status=PolicyResultStatus.WARNING,
            message=f"{len(hits)} TODO/FIXME marker(s) in diff content.",
            evidence={
                "matched_markers": hits,
                "non_test_files": non_test_files,
            },
        )
```

## 2. Register it

Add your class to `DEFAULT_POLICY_CLASSES` at the bottom of
`defaults.py`:

```python
DEFAULT_POLICY_CLASSES: list[type[Policy]] = [
    AuthChangeRequiresReview,
    SecretPatternDetection,
    TestRequiredForHighRisk,
    MigrationRequiresReview,
    LargeDiffRequiresHumanApproval,
    NoTodoInProductionFiles,   # ← here
]
```

## 3. Test it

Add a test class in
[`backend/tests/unit/test_policies.py`](../backend/tests/unit/test_policies.py)
covering at least:

- the **block / warn / pass** branches your policy can produce;
- the **"doesn't apply"** branch (returning `None`);
- a **custom config** override.

```python
class TestNoTodoInProductionFiles:
    def test_warning_on_todo_in_production(self) -> None:
        d, gc = _build_decision(files=["src/feature.py"])
        diff = "+ # TODO: rotate the key\n"
        v = NoTodoInProductionFiles().evaluate(PolicyContext(d, gc, diff_text=diff))
        assert v is not None
        assert v.status == PolicyResultStatus.WARNING

    def test_passes_when_only_test_files(self) -> None:
        d, gc = _build_decision(files=["tests/test_feature.py"])
        v = NoTodoInProductionFiles().evaluate(
            PolicyContext(d, gc, diff_text="+ # TODO: x")
        )
        assert v is not None
        assert v.status == PolicyResultStatus.PASSED

    def test_skipped_without_diff_text(self) -> None:
        d, gc = _build_decision(files=["src/x.py"])
        assert NoTodoInProductionFiles().evaluate(PolicyContext(d, gc, diff_text=None)) is None

    def test_custom_markers(self) -> None:
        d, gc = _build_decision(files=["src/feature.py"])
        v = NoTodoInProductionFiles(config={"markers": ["HACK"]}).evaluate(
            PolicyContext(d, gc, diff_text="+ # HACK: temp")
        )
        assert v is not None
        assert v.status == PolicyResultStatus.WARNING
```

Run `pytest tests/unit/test_policies.py -v` and confirm all four tests
pass.

## 4. Ship it

If your policy should be enabled out of the box for new projects, add a
config block to
[`cli/internal/embed/assets/policies.toml`](../cli/internal/embed/assets/policies.toml):

```toml
[no_todo_in_production_files]
enabled = true
severity = "medium"
markers = ["TODO", "FIXME", "XXX"]
```

`gf init` embeds this file via `go:embed`; new projects will get the
policy enabled with these defaults. Existing projects can copy the
section into their `.govforge/policies.toml` manually.

---

## Design rules

- **Pure functions.** A policy must not touch the database, network, or
  file system inside `evaluate`. The only inputs are `ctx.decision`,
  `ctx.git_change`, and `ctx.diff_text` — everything else is config.
- **Idempotent.** Calling `evaluate` twice with the same context must
  produce the same verdict. Don't capture wall-clock time; don't
  generate UUIDs.
- **Cheap.** Policies run on every `run_policy_checks` call. A policy
  that does heavy work (large regex over diff text > 100 KB, for
  example) will slow the whole run.
- **Return `None` when irrelevant.** The runner drops `None` outcomes —
  they don't appear in the timeline, the audit log, or the cockpit.
  Use this for risk-gated policies (`if risk < HIGH: return None`) or
  context-gated ones (`if git_change is None: return None`).
- **Evidence over prose.** Put structured data in `verdict.evidence`
  (matched files, regex captures, threshold values). The cockpit
  renders this dictionary; reviewers can act on facts.

## Where the runtime lives

| File                                       | Role                                       |
|--------------------------------------------|--------------------------------------------|
| `core/policies/base.py`                    | `Policy` ABC + `PolicyContext` + `PolicyVerdict` |
| `core/policies/defaults.py`                | The 5 ship-installed policies + registry   |
| `core/policies/loader.py`                  | TOML parser → `PolicySpec` list            |
| `core/policies/runner.py`                  | Pure evaluation loop                       |
| `core/services/policy_service.py`          | DB persistence + `decision.policy_evaluated` event |

A new policy doesn't need to touch any of those except `defaults.py`.
