"""End-to-end pipeline test (devis.md §21.2).

Walks the canonical workflow with real components — no mocks below the
service layer:

    init repo                 (real git)
    create task               (TaskService)
    create decision           (DecisionService)
    make commit               (real git)
    attach diff               (DecisionService.attach_git → core.git extractor)
    run policies              (PolicyService → real Policy classes)
    request + submit review   (ReviewService)
    record disagreement       (DisagreementService)
    approve decision          (ApprovalService)
    verify timeline           (TimelineService)

The DB is a file-backed SQLite (so cross-session reads work) and the Git
repo is a tmp directory with two commits — one of which touches an
auth-adjacent file so the auth_change_requires_review policy fires.
"""

from __future__ import annotations

import subprocess
from collections.abc import Generator
from pathlib import Path

import pytest
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

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
)
from govforge.core.models import Agent, Base, Project
from govforge.core.services import (
    ApprovalService,
    DecisionService,
    DisagreementService,
    EventService,
    FindingInput,
    PolicyService,
    ReviewService,
    TaskService,
    TimelineService,
)
from govforge.db.session import make_engine, make_session_factory


def _git(cwd: Path, *args: str) -> None:
    subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True)


@pytest.fixture()
def engine(tmp_path: Path) -> Generator[Engine]:
    db = tmp_path / "pipeline.db"
    e = make_engine(f"sqlite:///{db}")
    Base.metadata.create_all(e)
    try:
        yield e
    finally:
        e.dispose()


@pytest.fixture()
def session(engine: Engine) -> Generator[Session]:
    factory = make_session_factory(engine)
    s = factory()
    try:
        yield s
    finally:
        s.close()


@pytest.fixture()
def repo(tmp_path: Path) -> Path:
    """Two-commit repo where the second commit touches an auth-adjacent file."""
    d = tmp_path / "repo"
    d.mkdir()
    _git(d, "init", "-q", "-b", "main")
    _git(d, "config", "user.email", "t@x.io")
    _git(d, "config", "user.name", "T")
    (d / "README.md").write_text("# hello\n")
    _git(d, "add", "README.md")
    _git(d, "commit", "-q", "-m", "initial")
    (d / "auth.py").write_text("def login():\n    return True\n")
    _git(d, "add", ".")
    _git(d, "commit", "-q", "-m", "auth touch")
    return d


def test_full_pipeline(session: Session, repo: Path) -> None:
    # ── 1. project + agents ────────────────────────────────────────────
    project = Project(name="govforge", root_path=str(repo))
    claude = Agent(name="claude", type=AgentType.CLAUDE)
    codex = Agent(name="codex", type=AgentType.CODEX)
    eric = Agent(name="eric", type=AgentType.HUMAN)
    session.add_all([project, claude, codex, eric])
    session.commit()

    # ── 2. task ────────────────────────────────────────────────────────
    task = TaskService(session).create(
        project_id=project.id,
        title="Migrate session auth",
        risk_level=RiskLevel.HIGH,
        created_by_agent_id=eric.id,
    )
    session.commit()
    assert task.display_id == "TASK-001"
    assert task.status == TaskStatus.OPEN

    # ── 3. decision ────────────────────────────────────────────────────
    decision = DecisionService(session).create(
        project_id=project.id,
        task_id=task.id,
        author_agent_id=claude.id,
        title="Migrate to signed cookies",
        summary="Replace session lookup with signed cookie validation",
        rationale="Reduce DB roundtrips",
        risk_level=RiskLevel.HIGH,
    )
    session.commit()
    assert decision.display_id == "DEC-001"
    assert decision.status == DecisionStatus.DRAFT

    # ── 4. attach git ──────────────────────────────────────────────────
    git_change = DecisionService(session).attach_git(
        decision_id=decision.id,
        repo_path=str(repo),
        rev="HEAD",
        actor_agent_id=claude.id,
    )
    session.commit()
    assert "auth.py" in (git_change.files_changed_json or [])
    assert git_change.commit_hash
    assert git_change.diff_hash.startswith("sha256:")

    # ── 5. run policies ────────────────────────────────────────────────
    results = PolicyService(session).run_for_decision(
        decision_id=decision.id, actor_agent_id=claude.id
    )
    session.commit()
    statuses = {r.status for r in results}
    assert PolicyResultStatus.BLOCKED in statuses, (
        "auth_change_requires_review should fire on auth.py"
    )

    # ── 6. request review ──────────────────────────────────────────────
    ReviewService(session).request(
        decision_id=decision.id,
        reviewer_agent_id=codex.id,
        focus=["security", "tests"],
        actor_agent_id=claude.id,
    )
    session.commit()
    session.refresh(decision)
    assert decision.status == DecisionStatus.REVIEW_REQUIRED

    # ── 7. submit review with a structured finding ─────────────────────
    review = ReviewService(session).submit(
        decision_id=decision.id,
        reviewer_agent_id=codex.id,
        status=ReviewStatus.CHANGES_REQUESTED,
        summary="Session fixation risk",
        findings=[
            FindingInput(
                severity=FindingSeverity.HIGH,
                category=FindingCategory.SECURITY,
                file_path="auth.py",
                message="Session token not rotated after login",
                recommendation="Rotate session token after successful login",
            ),
        ],
    )
    session.commit()
    session.refresh(decision)
    assert review.display_id == "REV-001"
    assert decision.status == DecisionStatus.CHANGES_REQUESTED

    # ── 8. disagreement ────────────────────────────────────────────────
    DisagreementService(session).record(
        decision_id=decision.id,
        topic="session security",
        author_position="Signed cookies are safe",
        reviewer_position="Need rotation to prevent fixation",
        risk_summary="Attacker may reuse a fixed session id",
        requires_human_decision=True,
        actor_agent_id=codex.id,
    )
    session.commit()

    # ── 9. human approval ──────────────────────────────────────────────
    approval = ApprovalService(session).approve(
        decision_id=decision.id,
        approver_agent_id=eric.id,
        comment="Approved after rotation patch lands",
    )
    session.commit()
    session.refresh(decision)
    assert approval.status == ApprovalStatus.APPROVED
    assert decision.status == DecisionStatus.APPROVED

    # ── 10. timeline ───────────────────────────────────────────────────
    events = TimelineService(session).for_decision(decision.id)
    types = [e.event_type for e in events]

    # The full audit chain must be present and ordered.
    expected = [
        "decision.created",
        "decision.git_attached",
        "decision.policy_evaluated",
        "review.requested",
        "review.submitted",
        "decision.status_changed",  # CHANGES_REQUESTED transition
        "decision.approved",
    ]
    for needed in expected:
        assert needed in types, f"timeline missing {needed!r}; got {types}"

    # Per-event ordering: `decision.created` is first, `decision.approved` last.
    assert types[0] == "decision.created"
    assert types[-1] == "decision.approved"

    # Event count: at least one event per documented step + the bookkeeping
    # ones (status_changed). Lower bound is 7 because some overlap.
    assert len(events) >= 7

    # ── 11. project-level events feed ─────────────────────────────────
    project_events = EventService(session).list_for_project(project_id=project.id)
    assert len(project_events) >= len(events), (
        "project feed should include decision events plus the task.created event"
    )
