"""Smoke tests for SQLAlchemy models — creation, relations, cascades."""

from __future__ import annotations

import pytest
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
from govforge.core.ids import format_display_id, parse_display_id
from govforge.core.models import (
    Agent,
    Approval,
    Base,
    Decision,
    Disagreement,
    Event,
    Finding,
    GitChange,
    Policy,
    PolicyResult,
    Project,
    Review,
    Task,
)
from govforge.db.session import make_engine, make_session_factory


@pytest.fixture()
def session() -> Session:
    engine = make_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    factory = make_session_factory(engine)
    s = factory()
    try:
        yield s
    finally:
        s.close()
        engine.dispose()


def test_create_project(session: Session) -> None:
    p = Project(name="govforge-itself", root_path="/tmp/repo-1")
    session.add(p)
    session.commit()
    assert p.id is not None
    assert p.created_at is not None
    assert p.updated_at is not None
    assert p.default_branch == "main"


def test_create_agent_with_metadata(session: Session) -> None:
    a = Agent(name="claude", type=AgentType.CLAUDE, metadata_json={"version": "4.7"})
    session.add(a)
    session.commit()
    assert a.type is AgentType.CLAUDE
    assert a.metadata_json == {"version": "4.7"}


def test_full_decision_chain(session: Session) -> None:
    """Build a complete chain: project → task → decision → git_change → review → finding → approval."""
    project = Project(name="proj", root_path="/tmp/r2")
    eric = Agent(name="eric", type=AgentType.HUMAN)
    claude = Agent(name="claude", type=AgentType.CLAUDE)
    codex = Agent(name="codex", type=AgentType.CODEX)
    session.add_all([project, eric, claude, codex])
    session.flush()

    task = Task(
        project=project,
        display_id=format_display_id("TASK", 1),
        title="Migrate auth",
        risk_level=RiskLevel.HIGH,
        created_by_agent_id=eric.id,
    )
    session.add(task)
    session.flush()

    decision = Decision(
        project=project,
        task=task,
        author_agent_id=claude.id,
        display_id=format_display_id("DEC", 1),
        title="Signed cookies",
        status=DecisionStatus.REVIEW_REQUIRED,
        risk_level=RiskLevel.HIGH,
        human_approval_required=True,
    )
    session.add(decision)
    session.flush()

    gc = GitChange(
        decision=decision,
        repo_path="/tmp/r2",
        branch_name="feature/auth",
        commit_hash="a" * 40,
        files_changed_json=["auth.py", "middleware/session.py"],
        insertions=84,
        deletions=31,
    )
    session.add(gc)

    review = Review(
        decision=decision,
        reviewer_agent_id=codex.id,
        display_id=format_display_id("REV", 1),
        status=ReviewStatus.CHANGES_REQUESTED,
        summary="Session fixation risk",
    )
    session.add(review)
    session.flush()

    finding = Finding(
        review=review,
        severity=FindingSeverity.HIGH,
        category=FindingCategory.SECURITY,
        file_path="middleware/session.py",
        line_start=42,
        line_end=42,
        message="Session token not rotated after login",
        recommendation="Rotate session token on login",
    )
    session.add(finding)

    policy = Policy(name="auth_change_requires_review", severity=FindingSeverity.HIGH)
    session.add(policy)
    session.flush()

    pr = PolicyResult(
        decision=decision,
        policy_id=policy.id,
        status=PolicyResultStatus.BLOCKED,
        message="auth.py modified — review required",
    )
    session.add(pr)

    dis = Disagreement(
        decision=decision,
        topic="session security",
        author_position="Signed cookies are sufficient",
        reviewer_position="Signed cookies do not prevent fixation",
        risk_summary="Attacker may reuse a fixed session id",
    )
    session.add(dis)

    approval = Approval(
        decision=decision,
        approver_agent_id=eric.id,
        status=ApprovalStatus.APPROVED,
        comment="Approved after token rotation",
    )
    session.add(approval)

    evt = Event(
        project_id=project.id,
        entity_type="decision",
        entity_id=decision.id,
        event_type="decision.approved",
        actor_agent_id=eric.id,
        payload_json={"approval_id": str(approval.id)},
    )
    session.add(evt)
    session.commit()

    # Reload and assert relationships
    session.refresh(decision)
    assert len(decision.git_changes) == 1
    assert len(decision.reviews) == 1
    assert len(decision.reviews[0].findings) == 1
    assert len(decision.policy_results) == 1
    assert len(decision.disagreements) == 1
    assert len(decision.approvals) == 1
    assert decision.task.display_id == "TASK-001"
    assert decision.display_id == "DEC-001"


def test_cascade_delete_project(session: Session) -> None:
    """Deleting a project should cascade to tasks, decisions, events."""
    p = Project(name="x", root_path="/tmp/x")
    eric = Agent(name="eric2", type=AgentType.HUMAN)
    session.add_all([p, eric])
    session.flush()

    task = Task(project=p, display_id="TASK-001", title="t", created_by_agent_id=eric.id)
    decision = Decision(
        project=p,
        author_agent_id=eric.id,
        display_id="DEC-001",
        title="d",
    )
    session.add_all([task, decision])
    session.flush()
    event = Event(
        project_id=p.id,
        entity_type="task",
        entity_id=task.id,
        event_type="test",
    )
    session.add(event)
    session.commit()

    session.delete(p)
    session.commit()

    assert session.query(Project).count() == 0
    assert session.query(Task).count() == 0
    assert session.query(Decision).count() == 0
    assert session.query(Event).count() == 0
    # Agent should NOT be deleted
    assert session.query(Agent).filter_by(name="eric2").count() == 1


def test_unique_display_id_per_project(session: Session) -> None:
    p = Project(name="p", root_path="/tmp/u")
    eric = Agent(name="eric3", type=AgentType.HUMAN)
    session.add_all([p, eric])
    session.flush()

    session.add(
        Task(project=p, display_id="TASK-001", title="a", created_by_agent_id=eric.id)
    )
    session.commit()

    session.add(
        Task(project=p, display_id="TASK-001", title="dup", created_by_agent_id=eric.id)
    )
    with pytest.raises(Exception):  # IntegrityError variants per dialect
        session.commit()
    session.rollback()


def test_status_defaults(session: Session) -> None:
    p = Project(name="p2", root_path="/tmp/d")
    eric = Agent(name="eric4", type=AgentType.HUMAN)
    session.add_all([p, eric])
    session.flush()

    task = Task(project=p, display_id="TASK-001", title="default", created_by_agent_id=eric.id)
    session.add(task)
    session.commit()

    assert task.status is TaskStatus.OPEN
    assert task.risk_level is RiskLevel.MEDIUM


def test_display_id_helpers() -> None:
    assert format_display_id("TASK", 1) == "TASK-001"
    assert format_display_id("DEC", 42) == "DEC-042"
    assert format_display_id("REV", 1234) == "REV-1234"
    assert parse_display_id("TASK-001") == ("TASK", 1)
    assert parse_display_id("DEC-042") == ("DEC", 42)

    with pytest.raises(ValueError):
        format_display_id("TASK", 0)
    with pytest.raises(ValueError):
        parse_display_id("malformed")
