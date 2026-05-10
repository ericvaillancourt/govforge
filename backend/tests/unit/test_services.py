"""Tests for the service layer.

Pattern: each test creates an in-memory SQLite session, instantiates the
relevant service(s), runs through the workflow and asserts ORM state +
events emitted.
"""

from __future__ import annotations

from collections.abc import Generator
from pathlib import Path

import pytest
from sqlalchemy.orm import Session

from govforge.core.enums import (
    AgentType,
    DecisionStatus,
    FindingCategory,
    FindingSeverity,
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
    NotFoundError,
    ProjectService,
    ReviewService,
    TaskService,
    TimelineService,
)
from govforge.db.session import make_engine, make_session_factory


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
    p = ProjectService(session).create(name="govforge", root_path="/tmp/govforge")
    session.commit()
    return p


@pytest.fixture()
def agents(session: Session) -> dict[str, Agent]:
    eric = Agent(name="eric", type=AgentType.HUMAN)
    claude = Agent(name="claude", type=AgentType.CLAUDE)
    codex = Agent(name="codex", type=AgentType.CODEX)
    session.add_all([eric, claude, codex])
    session.commit()
    return {"eric": eric, "claude": claude, "codex": codex}


# ---------------------------------------------------------------------------
# ProjectService
# ---------------------------------------------------------------------------


class TestProjectService:
    def test_create_and_get_by_path(self, session: Session) -> None:
        svc = ProjectService(session)
        p = svc.create(name="x", root_path="/a/b/c")
        session.commit()
        assert svc.get_by_path("/a/b/c") == p
        assert svc.get_by_path("/nope") is None

    def test_get_or_create_idempotent(self, session: Session) -> None:
        svc = ProjectService(session)
        a = svc.get_or_create(name="x", root_path="/dup")
        session.commit()
        b = svc.get_or_create(name="other-name", root_path="/dup")
        session.commit()
        assert a.id == b.id


# ---------------------------------------------------------------------------
# TaskService
# ---------------------------------------------------------------------------


class TestTaskService:
    def test_create_assigns_display_id_and_event(
        self, session: Session, project: Project, agents: dict[str, Agent]
    ) -> None:
        svc = TaskService(session)
        t = svc.create(
            project_id=project.id,
            title="first",
            risk_level=RiskLevel.HIGH,
            created_by_agent_id=agents["eric"].id,
        )
        session.commit()
        assert t.display_id == "TASK-001"

        # Second task gets TASK-002
        t2 = svc.create(
            project_id=project.id, title="second", created_by_agent_id=agents["eric"].id
        )
        session.commit()
        assert t2.display_id == "TASK-002"

        # Event was logged
        events = EventService(session).list_for_entity(entity_type="task", entity_id=t.id)
        assert any(e.event_type == "task.created" for e in events)

    def test_update_status_no_op_when_same(
        self, session: Session, project: Project, agents: dict[str, Agent]
    ) -> None:
        svc = TaskService(session)
        t = svc.create(project_id=project.id, title="t", created_by_agent_id=agents["eric"].id)
        session.commit()
        before = len(EventService(session).list_for_entity(entity_type="task", entity_id=t.id))
        svc.update_status(task_id=t.id, status=TaskStatus.OPEN)
        session.commit()
        after = len(EventService(session).list_for_entity(entity_type="task", entity_id=t.id))
        assert before == after  # no event for no-op

    def test_update_status_emits_event_on_change(
        self, session: Session, project: Project, agents: dict[str, Agent]
    ) -> None:
        svc = TaskService(session)
        t = svc.create(project_id=project.id, title="t", created_by_agent_id=agents["eric"].id)
        session.commit()
        svc.update_status(
            task_id=t.id,
            status=TaskStatus.IN_PROGRESS,
            actor_agent_id=agents["eric"].id,
        )
        session.commit()
        events = EventService(session).list_for_entity(entity_type="task", entity_id=t.id)
        change_events = [e for e in events if e.event_type == "task.status_changed"]
        assert len(change_events) == 1
        assert change_events[0].payload_json == {"from": "open", "to": "in_progress"}

    def test_get_or_404(self, session: Session) -> None:
        svc = TaskService(session)
        from uuid import uuid4

        with pytest.raises(NotFoundError):
            svc.get_or_404(uuid4())

    def test_list_filters(
        self, session: Session, project: Project, agents: dict[str, Agent]
    ) -> None:
        svc = TaskService(session)
        a = svc.create(project_id=project.id, title="a", created_by_agent_id=agents["eric"].id)
        b = svc.create(project_id=project.id, title="b", created_by_agent_id=agents["eric"].id)
        svc.update_status(task_id=b.id, status=TaskStatus.IN_PROGRESS)
        session.commit()
        opened = svc.list(project_id=project.id, status=TaskStatus.OPEN)
        in_progress = svc.list(project_id=project.id, status=TaskStatus.IN_PROGRESS)
        assert [t.id for t in opened] == [a.id]
        assert [t.id for t in in_progress] == [b.id]


# ---------------------------------------------------------------------------
# DecisionService (creation + status; attach_git tested separately with a real repo)
# ---------------------------------------------------------------------------


class TestDecisionService:
    def test_create_assigns_display_id(
        self, session: Session, project: Project, agents: dict[str, Agent]
    ) -> None:
        svc = DecisionService(session)
        d = svc.create(
            project_id=project.id,
            author_agent_id=agents["claude"].id,
            title="Migrate auth",
            risk_level=RiskLevel.HIGH,
        )
        session.commit()
        assert d.display_id == "DEC-001"
        assert d.status == DecisionStatus.DRAFT

    def test_attach_git_populates_change_and_event(
        self,
        session: Session,
        project: Project,
        agents: dict[str, Agent],
        tmp_path: Path,
    ) -> None:
        # Build a tiny real repo so attach_git can run
        import subprocess

        repo = tmp_path / "r"
        repo.mkdir()

        def _g(*args: str) -> None:
            subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True, text=True)

        _g("init", "-q", "-b", "main")
        _g("config", "user.email", "t@t.com")
        _g("config", "user.name", "T")
        (repo / "f.txt").write_text("v1\n")
        _g("add", ".")
        _g("commit", "-q", "-m", "first")

        svc = DecisionService(session)
        d = svc.create(
            project_id=project.id,
            author_agent_id=agents["claude"].id,
            title="X",
        )
        session.commit()

        gc = svc.attach_git(
            decision_id=d.id,
            repo_path=str(repo),
            rev="HEAD",
            actor_agent_id=agents["claude"].id,
        )
        session.commit()

        assert gc.commit_hash and len(gc.commit_hash) == 40
        assert gc.files_changed_json == ["f.txt"]
        assert gc.diff_hash.startswith("sha256:")

        events = EventService(session).list_for_entity(entity_type="decision", entity_id=d.id)
        types = [e.event_type for e in events]
        assert "decision.git_attached" in types

    def test_attach_git_unknown_decision(self, session: Session, tmp_path: Path) -> None:
        svc = DecisionService(session)
        from uuid import uuid4

        with pytest.raises(NotFoundError):
            svc.attach_git(decision_id=uuid4(), repo_path=str(tmp_path), rev="HEAD")


# ---------------------------------------------------------------------------
# ReviewService
# ---------------------------------------------------------------------------


class TestReviewService:
    def test_request_marks_decision_review_required(
        self, session: Session, project: Project, agents: dict[str, Agent]
    ) -> None:
        ds = DecisionService(session)
        rs = ReviewService(session)
        d = ds.create(project_id=project.id, author_agent_id=agents["claude"].id, title="x")
        session.commit()
        rs.request(
            decision_id=d.id,
            reviewer_agent_id=agents["codex"].id,
            focus=["security"],
            actor_agent_id=agents["claude"].id,
        )
        session.commit()
        session.refresh(d)
        assert d.status == DecisionStatus.REVIEW_REQUIRED

    def test_submit_with_findings_changes_decision_status(
        self, session: Session, project: Project, agents: dict[str, Agent]
    ) -> None:
        ds = DecisionService(session)
        rs = ReviewService(session)
        d = ds.create(project_id=project.id, author_agent_id=agents["claude"].id, title="x")
        session.commit()

        review = rs.submit(
            decision_id=d.id,
            reviewer_agent_id=agents["codex"].id,
            status=ReviewStatus.CHANGES_REQUESTED,
            summary="blocking",
            findings=[
                FindingInput(
                    severity=FindingSeverity.HIGH,
                    category=FindingCategory.SECURITY,
                    file_path="auth.py",
                    line_start=42,
                    line_end=42,
                    message="session fixation",
                ),
            ],
        )
        session.commit()

        session.refresh(d)
        assert d.status == DecisionStatus.CHANGES_REQUESTED
        assert review.display_id == "REV-001"
        assert len(review.findings) == 1

    def test_approved_review_does_not_auto_approve_decision(
        self, session: Session, project: Project, agents: dict[str, Agent]
    ) -> None:
        ds = DecisionService(session)
        rs = ReviewService(session)
        d = ds.create(project_id=project.id, author_agent_id=agents["claude"].id, title="x")
        session.commit()
        rs.submit(
            decision_id=d.id,
            reviewer_agent_id=agents["codex"].id,
            status=ReviewStatus.APPROVED,
        )
        session.commit()
        session.refresh(d)
        # Decision still DRAFT — only a human Approval can move it to APPROVED
        assert d.status == DecisionStatus.DRAFT


# ---------------------------------------------------------------------------
# DisagreementService
# ---------------------------------------------------------------------------


class TestDisagreementService:
    def test_record_and_resolve(
        self, session: Session, project: Project, agents: dict[str, Agent]
    ) -> None:
        ds = DecisionService(session)
        dgs = DisagreementService(session)
        d = ds.create(project_id=project.id, author_agent_id=agents["claude"].id, title="x")
        session.commit()

        disagreement = dgs.record(
            decision_id=d.id,
            topic="session security",
            author_position="signed cookies are sufficient",
            reviewer_position="signed cookies do not prevent fixation",
            actor_agent_id=agents["claude"].id,
        )
        session.commit()

        resolved = dgs.resolve(
            disagreement_id=disagreement.id,
            resolution="rotate token after login",
            resolved_by_agent_id=agents["eric"].id,
        )
        session.commit()
        assert resolved.resolution == "rotate token after login"
        assert resolved.resolved_by_agent_id == agents["eric"].id
        assert resolved.resolved_at is not None


# ---------------------------------------------------------------------------
# ApprovalService
# ---------------------------------------------------------------------------


class TestApprovalService:
    def test_approve_moves_decision_to_approved(
        self, session: Session, project: Project, agents: dict[str, Agent]
    ) -> None:
        ds = DecisionService(session)
        aps = ApprovalService(session)
        d = ds.create(
            project_id=project.id,
            author_agent_id=agents["claude"].id,
            title="x",
            human_approval_required=True,
        )
        session.commit()
        ap = aps.approve(
            decision_id=d.id,
            approver_agent_id=agents["eric"].id,
            comment="LGTM after rotation",
        )
        session.commit()
        session.refresh(d)
        assert d.status == DecisionStatus.APPROVED
        assert ap.comment == "LGTM after rotation"

    def test_reject_moves_decision_to_rejected(
        self, session: Session, project: Project, agents: dict[str, Agent]
    ) -> None:
        ds = DecisionService(session)
        aps = ApprovalService(session)
        d = ds.create(project_id=project.id, author_agent_id=agents["claude"].id, title="x")
        session.commit()
        aps.reject(decision_id=d.id, approver_agent_id=agents["eric"].id, comment="no")
        session.commit()
        session.refresh(d)
        assert d.status == DecisionStatus.REJECTED

    def test_list_pending(
        self, session: Session, project: Project, agents: dict[str, Agent]
    ) -> None:
        ds = DecisionService(session)
        rs = ReviewService(session)
        aps = ApprovalService(session)

        # Decision A: human_approval_required, in REVIEW_REQUIRED → should appear
        a = ds.create(
            project_id=project.id,
            author_agent_id=agents["claude"].id,
            title="a",
            human_approval_required=True,
        )
        rs.request(decision_id=a.id, reviewer_agent_id=agents["codex"].id)
        # Decision B: not requiring human approval → should NOT appear
        b = ds.create(
            project_id=project.id,
            author_agent_id=agents["claude"].id,
            title="b",
            human_approval_required=False,
        )
        rs.request(decision_id=b.id, reviewer_agent_id=agents["codex"].id)
        session.commit()

        pending = aps.list_pending(project_id=project.id)
        assert [d.id for d in pending] == [a.id]


# ---------------------------------------------------------------------------
# TimelineService
# ---------------------------------------------------------------------------


class TestTimelineService:
    def test_for_decision_chronological(
        self, session: Session, project: Project, agents: dict[str, Agent]
    ) -> None:
        ds = DecisionService(session)
        rs = ReviewService(session)
        aps = ApprovalService(session)
        ts = TimelineService(session)

        d = ds.create(project_id=project.id, author_agent_id=agents["claude"].id, title="x")
        rs.request(decision_id=d.id, reviewer_agent_id=agents["codex"].id)
        rs.submit(
            decision_id=d.id,
            reviewer_agent_id=agents["codex"].id,
            status=ReviewStatus.CHANGES_REQUESTED,
        )
        aps.approve(decision_id=d.id, approver_agent_id=agents["eric"].id)
        session.commit()

        events = ts.for_decision(d.id)
        types = [e.event_type for e in events]
        # Order matters: created → review.requested → status_changed (CHANGES_REQUESTED)
        # → review.submitted → status_changed (APPROVED) → decision.approved
        assert types[0] == "decision.created"
        assert "review.requested" in types
        assert "review.submitted" in types
        assert "decision.approved" in types
        # Strictly non-decreasing timestamps
        timestamps = [e.created_at for e in events]
        assert timestamps == sorted(timestamps)

    def test_for_task_includes_decision_events(
        self, session: Session, project: Project, agents: dict[str, Agent]
    ) -> None:
        from govforge.core.services import TaskService

        ts_svc = TaskService(session)
        ds = DecisionService(session)
        ts = TimelineService(session)

        t = ts_svc.create(project_id=project.id, title="t", created_by_agent_id=agents["eric"].id)
        d = ds.create(
            project_id=project.id,
            author_agent_id=agents["claude"].id,
            title="d",
            task_id=t.id,
        )
        session.commit()

        events = ts.for_task(t.id)
        types = [e.event_type for e in events]
        assert "task.created" in types
        assert "decision.created" in types
        # Both events related to this task surface in the same timeline
        assert any(e.entity_id == t.id for e in events)
        assert any(e.entity_id == d.id for e in events)
