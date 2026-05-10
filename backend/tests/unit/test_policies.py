"""Tests for the policy engine.

Three layers:

1. Per-policy unit tests — feed a `PolicyContext` directly.
2. Loader tests — TOML round-trip + unknown sections.
3. PolicyService tests — DB persistence + event emission.
"""

from __future__ import annotations

from collections.abc import Generator
from uuid import uuid4

import pytest
from sqlalchemy.orm import Session

from govforge.core.enums import (
    AgentType,
    DecisionStatus,
    FindingSeverity,
    PolicyResultStatus,
    RiskLevel,
)
from govforge.core.models import Agent, Base, Decision, GitChange, Project
from govforge.core.policies import (
    AuthChangeRequiresReview,
    LargeDiffRequiresHumanApproval,
    MigrationRequiresReview,
    PolicyContext,
    PolicySpec,
    SecretPatternDetection,
    TestRequiredForHighRisk,
    instantiate_enabled,
    load_policy_specs,
    parse_policy_config,
    run_policies,
)
from govforge.core.services import (
    DecisionService,
    EventService,
    NotFoundError,
    PolicyService,
    ProjectService,
)
from govforge.db.session import make_engine, make_session_factory

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def session() -> Generator[Session]:
    engine = make_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    factory = make_session_factory(engine)
    s = factory()
    try:
        yield s
    finally:
        s.close()
        engine.dispose()


@pytest.fixture()
def project(session: Session) -> Project:
    p = ProjectService(session).create(name="t", root_path="/tmp/t")
    session.commit()
    return p


@pytest.fixture()
def claude(session: Session) -> Agent:
    a = Agent(name="claude", type=AgentType.CLAUDE)
    session.add(a)
    session.commit()
    return a


def _build_decision(
    *,
    risk: RiskLevel = RiskLevel.MEDIUM,
    files: list[str] | None = None,
    insertions: int = 10,
    deletions: int = 5,
    project_id: str | None = None,
    author_id: str | None = None,
) -> tuple[Decision, GitChange]:
    """Build an unattached Decision + GitChange (no DB)."""
    decision = Decision(
        id=uuid4(),
        project_id=project_id or uuid4(),
        author_agent_id=author_id or uuid4(),
        display_id="DEC-001",
        title="t",
        risk_level=risk,
        status=DecisionStatus.DRAFT,
    )
    git_change = GitChange(
        id=uuid4(),
        decision_id=decision.id,
        repo_path="/tmp/repo",
        commit_hash="a" * 40,
        diff_hash="sha256:0",
        files_changed_json=files or [],
        insertions=insertions,
        deletions=deletions,
    )
    return decision, git_change


# ---------------------------------------------------------------------------
# Per-policy unit tests
# ---------------------------------------------------------------------------


class TestAuthChangeRequiresReview:
    def test_blocks_when_auth_file_touched(self) -> None:
        d, gc = _build_decision(files=["src/auth/jwt.py", "README.md"])
        v = AuthChangeRequiresReview().evaluate(PolicyContext(d, gc))
        assert v is not None
        assert v.status == PolicyResultStatus.BLOCKED
        assert "src/auth/jwt.py" in v.evidence["matched_files"]  # type: ignore[index]

    def test_passes_when_no_match(self) -> None:
        d, gc = _build_decision(files=["src/utils.py"])
        v = AuthChangeRequiresReview().evaluate(PolicyContext(d, gc))
        assert v is not None
        assert v.status == PolicyResultStatus.PASSED

    def test_skipped_when_no_git_change(self) -> None:
        d, _ = _build_decision()
        assert AuthChangeRequiresReview().evaluate(PolicyContext(d, None)) is None

    def test_custom_patterns_via_config(self) -> None:
        d, gc = _build_decision(files=["src/billing/charge.py"])
        v = AuthChangeRequiresReview(config={"patterns": ["billing"]}).evaluate(
            PolicyContext(d, gc)
        )
        assert v is not None
        assert v.status == PolicyResultStatus.BLOCKED


class TestSecretPatternDetection:
    def test_warning_for_dotenv_filename(self) -> None:
        d, gc = _build_decision(files=[".env.production"])
        v = SecretPatternDetection().evaluate(PolicyContext(d, gc, diff_text=""))
        assert v is not None
        assert v.status == PolicyResultStatus.WARNING

    def test_blocked_when_diff_contains_secret(self) -> None:
        d, gc = _build_decision(files=["app/config.py"])
        diff = "+ AWS_SECRET_ACCESS_KEY=abc123def456\n"
        v = SecretPatternDetection().evaluate(PolicyContext(d, gc, diff_text=diff))
        assert v is not None
        assert v.status == PolicyResultStatus.BLOCKED
        assert "AWS_SECRET_ACCESS_KEY" in v.evidence["matched_content_patterns"]  # type: ignore[index]

    def test_passes_clean(self) -> None:
        d, gc = _build_decision(files=["src/feature.py"])
        v = SecretPatternDetection().evaluate(PolicyContext(d, gc, diff_text="+ x = 1"))
        assert v is not None
        assert v.status == PolicyResultStatus.PASSED


class TestTestRequiredForHighRisk:
    def test_passes_with_test_file(self) -> None:
        d, gc = _build_decision(risk=RiskLevel.HIGH, files=["src/auth.py", "tests/test_auth.py"])
        v = TestRequiredForHighRisk().evaluate(PolicyContext(d, gc))
        assert v is not None
        assert v.status == PolicyResultStatus.PASSED

    def test_warning_high_risk_no_tests(self) -> None:
        d, gc = _build_decision(risk=RiskLevel.CRITICAL, files=["src/auth.py"])
        v = TestRequiredForHighRisk().evaluate(PolicyContext(d, gc))
        assert v is not None
        assert v.status == PolicyResultStatus.WARNING

    def test_skipped_for_medium_risk(self) -> None:
        d, gc = _build_decision(risk=RiskLevel.MEDIUM, files=["src/x.py"])
        assert TestRequiredForHighRisk().evaluate(PolicyContext(d, gc)) is None


class TestMigrationRequiresReview:
    def test_blocks_alembic_migration(self) -> None:
        d, gc = _build_decision(files=["backend/alembic/versions/0001_init.py"])
        v = MigrationRequiresReview().evaluate(PolicyContext(d, gc))
        assert v is not None
        assert v.status == PolicyResultStatus.BLOCKED

    def test_blocks_django_style_migration(self) -> None:
        d, gc = _build_decision(files=["app/migrations/0042_add_column.py"])
        v = MigrationRequiresReview().evaluate(PolicyContext(d, gc))
        assert v is not None
        assert v.status == PolicyResultStatus.BLOCKED

    def test_passes_no_migration(self) -> None:
        d, gc = _build_decision(files=["src/x.py"])
        v = MigrationRequiresReview().evaluate(PolicyContext(d, gc))
        assert v is not None
        assert v.status == PolicyResultStatus.PASSED


class TestLargeDiffRequiresHumanApproval:
    def test_passes_under_threshold(self) -> None:
        d, gc = _build_decision(insertions=100, deletions=50)
        v = LargeDiffRequiresHumanApproval().evaluate(PolicyContext(d, gc))
        assert v is not None
        assert v.status == PolicyResultStatus.PASSED

    def test_blocks_over_threshold(self) -> None:
        d, gc = _build_decision(insertions=400, deletions=200)
        v = LargeDiffRequiresHumanApproval().evaluate(PolicyContext(d, gc))
        assert v is not None
        assert v.status == PolicyResultStatus.BLOCKED

    def test_custom_threshold(self) -> None:
        d, gc = _build_decision(insertions=20, deletions=5)
        v = LargeDiffRequiresHumanApproval(config={"max_lines_changed": 10}).evaluate(
            PolicyContext(d, gc)
        )
        assert v is not None
        assert v.status == PolicyResultStatus.BLOCKED


# ---------------------------------------------------------------------------
# Loader
# ---------------------------------------------------------------------------


class TestLoader:
    def test_parse_policy_config(self) -> None:
        raw = {
            "auth_change_requires_review": {
                "enabled": True,
                "severity": "high",
                "patterns": ["auth"],
            },
            "large_diff_requires_human_approval": {
                "enabled": False,
                "max_lines_changed": 1000,
            },
            "unknown_policy": {"enabled": True},
        }
        specs = parse_policy_config(raw)
        by_name = {s.name: s for s in specs}
        assert "auth_change_requires_review" in by_name
        assert by_name["auth_change_requires_review"].severity == FindingSeverity.HIGH
        assert by_name["auth_change_requires_review"].config == {"patterns": ["auth"]}
        assert not by_name["large_diff_requires_human_approval"].enabled
        assert "unknown_policy" not in by_name

    def test_load_no_file_returns_defaults(self, tmp_path) -> None:  # type: ignore[no-untyped-def]
        specs = load_policy_specs(tmp_path / "nope.toml")
        assert {s.name for s in specs} == {
            "auth_change_requires_review",
            "secret_pattern_detection",
            "test_required_for_high_risk",
            "migration_requires_review",
            "large_diff_requires_human_approval",
        }
        assert all(s.enabled for s in specs)

    def test_load_from_toml(self, tmp_path) -> None:  # type: ignore[no-untyped-def]
        p = tmp_path / "policies.toml"
        p.write_text(
            "[large_diff_requires_human_approval]\nenabled = true\nmax_lines_changed = 50\n"
        )
        specs = load_policy_specs(p)
        match = [s for s in specs if s.name == "large_diff_requires_human_approval"]
        assert len(match) == 1
        assert match[0].config == {"max_lines_changed": 50}

    def test_instantiate_enabled_filters_disabled(self) -> None:
        spec = PolicySpec(
            name="auth_change_requires_review",
            cls=AuthChangeRequiresReview,
            enabled=False,
            severity=FindingSeverity.LOW,
            config={},
        )
        assert instantiate_enabled([spec]) == []


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------


class TestRunner:
    def test_drops_inapplicable_policies(self) -> None:
        d, gc = _build_decision(risk=RiskLevel.LOW, files=["src/x.py"])
        outcomes = run_policies(
            [
                AuthChangeRequiresReview(),
                TestRequiredForHighRisk(),  # skipped: risk=LOW
            ],
            PolicyContext(d, gc),
        )
        names = [o.policy.name for o in outcomes]
        assert names == ["auth_change_requires_review"]


# ---------------------------------------------------------------------------
# PolicyService (DB)
# ---------------------------------------------------------------------------


class TestPolicyService:
    def _attach_decision_with_git(
        self, session: Session, project: Project, claude: Agent, files: list[str]
    ) -> Decision:
        d = DecisionService(session).create(
            project_id=project.id,
            author_agent_id=claude.id,
            title="t",
            risk_level=RiskLevel.MEDIUM,
        )
        gc = GitChange(
            decision_id=d.id,
            repo_path="/tmp/repo",
            commit_hash="b" * 40,
            diff_hash="sha256:0",
            files_changed_json=files,
            insertions=20,
            deletions=10,
        )
        session.add(gc)
        session.commit()
        return d

    def test_run_persists_results_and_events(
        self, session: Session, project: Project, claude: Agent
    ) -> None:
        d = self._attach_decision_with_git(session, project, claude, files=["src/auth/jwt.py"])
        svc = PolicyService(session)
        results = svc.run_for_decision(
            decision_id=d.id,
            policies=[AuthChangeRequiresReview(), LargeDiffRequiresHumanApproval()],
            actor_agent_id=claude.id,
        )
        session.commit()
        assert len(results) == 2
        statuses = {r.status for r in results}
        assert PolicyResultStatus.BLOCKED in statuses

        # Events
        events = EventService(session).list_for_entity(entity_type="decision", entity_id=d.id)
        types = [e.event_type for e in events]
        assert "decision.policy_evaluated" in types
        eval_event = next(e for e in events if e.event_type == "decision.policy_evaluated")
        assert eval_event.payload_json is not None
        assert eval_event.payload_json["policy_count"] == 2

    def test_sync_creates_policy_rows(
        self, session: Session, project: Project, claude: Agent
    ) -> None:
        d = self._attach_decision_with_git(session, project, claude, files=["src/x.py"])
        svc = PolicyService(session)
        svc.run_for_decision(decision_id=d.id, actor_agent_id=claude.id)
        session.commit()
        results = svc.list_for_decision(d.id)
        # Defaults run: at least 4 outcomes (auth, secret, migration, large_diff). Test policy
        # is risk-gated and skipped at MEDIUM risk.
        assert len(results) >= 4

    def test_run_unknown_decision_raises(self, session: Session) -> None:
        with pytest.raises(NotFoundError):
            PolicyService(session).run_for_decision(decision_id=uuid4())
