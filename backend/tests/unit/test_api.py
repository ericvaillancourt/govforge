"""Integration tests for the HTTP API.

Pattern: FastAPI's TestClient over a file-backed SQLite DB so multiple
DB sessions opened by the request handlers see consistent state.
"""

from __future__ import annotations

import subprocess
from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from govforge.api.app import create_app
from govforge.core.models import Base
from govforge.db.session import make_engine, make_session_factory

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def client(tmp_path: Path) -> Generator[TestClient]:
    db = tmp_path / "api.db"
    engine = make_engine(f"sqlite:///{db}")
    Base.metadata.create_all(engine)
    factory = make_session_factory(engine)
    app = create_app(factory)
    with TestClient(app) as c:
        yield c
    engine.dispose()


def _run_git(cwd: Path, *args: str) -> None:
    subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True)


@pytest.fixture()
def git_repo(tmp_path: Path) -> Path:
    repo = tmp_path / "proj"
    repo.mkdir()
    _run_git(repo, "init", "-q", "-b", "main")
    _run_git(repo, "config", "user.email", "t@x.io")
    _run_git(repo, "config", "user.name", "T")
    (repo / "README.md").write_text("# hello\n")
    _run_git(repo, "add", "README.md")
    _run_git(repo, "commit", "-q", "-m", "initial")
    (repo / "auth.py").write_text("def login():\n    return True\n")
    _run_git(repo, "add", ".")
    _run_git(repo, "commit", "-q", "-m", "auth touch")
    return repo


# ---------------------------------------------------------------------------
# Health + OpenAPI
# ---------------------------------------------------------------------------


class TestHealthAndDocs:
    def test_health_ok(self, client: TestClient) -> None:
        r = client.get("/health")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "ok"
        assert "version" in body

    def test_openapi_lists_all_routes(self, client: TestClient) -> None:
        r = client.get("/openapi.json")
        assert r.status_code == 200
        paths = set(r.json()["paths"].keys())
        # Spot-check a representative subset (full set covered by /openapi explicit listing)
        for path in {
            "/health",
            "/projects",
            "/tasks",
            "/decisions",
            "/decisions/{decision_id}/timeline",
            "/decisions/{decision_id}/attach-git",
            "/decisions/{decision_id}/approve",
            "/decisions/{decision_id}/reject",
            "/reviews/request",
            "/reviews",
            "/reviews/{review_id}",
            "/policies",
            "/policies/check",
            "/events",
        }:
            assert path in paths, path


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------


class TestProjects:
    def test_create_and_list(self, client: TestClient) -> None:
        r = client.post("/projects", json={"name": "p", "root_path": "/tmp/p"})
        assert r.status_code == 201
        pid = r.json()["id"]
        r2 = client.get("/projects")
        assert r2.status_code == 200
        body = r2.json()
        assert any(p["id"] == pid for p in body)

    def test_create_idempotent_on_path(self, client: TestClient) -> None:
        r1 = client.post("/projects", json={"name": "a", "root_path": "/tmp/dup"})
        r2 = client.post("/projects", json={"name": "b", "root_path": "/tmp/dup"})
        assert r1.json()["id"] == r2.json()["id"]

    def test_extra_keys_rejected(self, client: TestClient) -> None:
        r = client.post(
            "/projects",
            json={"name": "x", "root_path": "/y", "garbage": True},
        )
        assert r.status_code == 422


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------


class TestTasks:
    def test_create_and_get(self, client: TestClient) -> None:
        client.post("/projects", json={"name": "p", "root_path": "/tmp/t"})
        r = client.post(
            "/tasks",
            json={
                "project_path": "/tmp/t",
                "title": "Refactor auth",
                "risk_level": "high",
                "actor_agent": "claude",
            },
        )
        assert r.status_code == 201
        body = r.json()
        assert body["display_id"] == "TASK-001"
        assert body["risk_level"] == "high"

        # Lookup by display_id
        r2 = client.get("/tasks/TASK-001")
        assert r2.status_code == 200
        assert r2.json()["display_id"] == "TASK-001"

    def test_unknown_project_returns_404(self, client: TestClient) -> None:
        r = client.post("/tasks", json={"project_path": "/nope", "title": "x"})
        assert r.status_code == 404

    def test_get_unknown_task(self, client: TestClient) -> None:
        r = client.get("/tasks/TASK-999")
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# End-to-end workflow
# ---------------------------------------------------------------------------


class TestFullWorkflow:
    def test_claude_codex_approval(self, client: TestClient, git_repo: Path) -> None:
        # 1. Project + task
        client.post("/projects", json={"name": "p", "root_path": str(git_repo)})
        task = client.post(
            "/tasks",
            json={
                "project_path": str(git_repo),
                "title": "Migrate session auth",
                "risk_level": "high",
                "actor_agent": "claude",
            },
        ).json()
        task_id = task["display_id"]

        # 2. Decision
        decision = client.post(
            "/decisions",
            json={
                "task_id": task_id,
                "author_agent": "claude",
                "title": "Migrate to signed cookies",
                "risk_level": "high",
            },
        ).json()
        dec_id = decision["display_id"]
        assert dec_id == "DEC-001"

        # 3. Attach git
        gc = client.post(
            f"/decisions/{dec_id}/attach-git",
            json={"repo_path": str(git_repo), "actor_agent": "claude"},
        )
        assert gc.status_code == 201
        assert "auth.py" in gc.json()["files_changed_json"]

        # 4. Policy check — auth_change_requires_review must block
        check = client.post(
            "/policies/check",
            json={"decision_id": dec_id, "actor_agent": "claude"},
        )
        assert check.status_code == 201
        statuses = {r["status"] for r in check.json()}
        assert "blocked" in statuses

        # 5. Request review
        rr = client.post(
            "/reviews/request",
            json={"decision_id": dec_id, "reviewer_agent": "codex"},
        )
        assert rr.status_code == 200
        assert rr.json()["status"] == "review_required"

        # 6. Submit review (changes requested)
        sub = client.post(
            "/reviews",
            json={
                "decision_id": dec_id,
                "reviewer_agent": "codex",
                "status": "changes_requested",
                "summary": "Need rotation",
                "findings": [
                    {
                        "severity": "high",
                        "category": "security",
                        "file_path": "auth.py",
                        "message": "Token not rotated",
                        "recommendation": "Rotate after login",
                    }
                ],
            },
        )
        assert sub.status_code == 201
        review_id = sub.json()["display_id"]
        assert review_id == "REV-001"

        # 7. Approve
        ap = client.post(
            f"/decisions/{dec_id}/approve",
            json={"approver": "eric", "comment": "OK after patch"},
        )
        assert ap.status_code == 201
        assert ap.json()["status"] == "approved"

        # 8. Verify decision is APPROVED
        d = client.get(f"/decisions/{dec_id}").json()
        assert d["status"] == "approved"

        # 9. Timeline contains the canonical events
        tl = client.get(f"/decisions/{dec_id}/timeline").json()
        types = {e["event_type"] for e in tl}
        assert "decision.created" in types
        assert "decision.git_attached" in types
        assert "review.requested" in types
        assert "review.submitted" in types
        assert "decision.approved" in types

        # 10. Review lookups work
        rev = client.get(f"/reviews/{review_id}").json()
        assert rev["display_id"] == "REV-001"
        assert len(rev["findings"]) == 1

        # 11. Open reviews list (decision is now APPROVED so list_open returns empty)
        openrev = client.get(
            "/reviews", params={"project_path": str(git_repo), "open_only": True}
        ).json()
        assert openrev == []

        # 12. Events filtered by entity
        evts = client.get(
            "/events",
            params={"entity_type": "decision", "entity_id": dec_id},
        ).json()
        assert any(e["event_type"] == "decision.approved" for e in evts)

    def test_reject_flow(self, client: TestClient, git_repo: Path) -> None:
        client.post("/projects", json={"name": "p", "root_path": str(git_repo)})
        task = client.post("/tasks", json={"project_path": str(git_repo), "title": "x"}).json()
        decision = client.post(
            "/decisions",
            json={
                "task_id": task["display_id"],
                "author_agent": "claude",
                "title": "x",
            },
        ).json()
        ap = client.post(
            f"/decisions/{decision['display_id']}/reject",
            json={"approver": "eric", "comment": "no"},
        )
        assert ap.status_code == 201
        assert ap.json()["status"] == "rejected"
        d = client.get(f"/decisions/{decision['display_id']}").json()
        assert d["status"] == "rejected"


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------


class TestErrors:
    def test_attach_git_unknown_decision(self, client: TestClient) -> None:
        r = client.post(
            "/decisions/DEC-999/attach-git",
            json={"repo_path": "/tmp/x"},
        )
        assert r.status_code == 404

    def test_events_requires_filter(self, client: TestClient) -> None:
        r = client.get("/events")
        assert r.status_code == 400

    def test_list_decisions_unknown_project(self, client: TestClient) -> None:
        r = client.get("/decisions", params={"project_path": "/nope"})
        assert r.status_code == 404
