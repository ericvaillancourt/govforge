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
from govforge.api.auth import (
    extract_prefix,
    generate_token_secret,
    hash_token_secret,
)
from govforge.core.enums import AgentType, TokenScope
from govforge.core.models import ApiToken, Base, User
from govforge.db.session import make_engine, make_session_factory

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def client(tmp_path: Path) -> Generator[TestClient]:
    """API client pre-authenticated with an admin token.

    Phase 3.0 Stage A locks every route behind Bearer + scope. Tests use a
    bootstrap admin user with the `admin` scope so existing assertions keep
    passing; tests that exercise the auth gate itself instantiate their own
    TestClient(app) without the header.
    """
    db = tmp_path / "api.db"
    engine = make_engine(f"sqlite:///{db}")
    Base.metadata.create_all(engine)
    factory = make_session_factory(engine)

    secret = generate_token_secret()
    with factory() as s:
        u = User(email="test-admin@local", display_name="Test Admin")
        s.add(u)
        s.flush()
        t = ApiToken(
            user_id=u.id,
            label="pytest-admin",
            agent_type=AgentType.HUMAN,
            prefix=extract_prefix(secret),
            hashed_secret=hash_token_secret(secret),
        )
        t.scopes = [TokenScope.ADMIN]
        s.add(t)
        s.commit()

    app = create_app(factory)
    with TestClient(app, headers={"Authorization": f"Bearer {secret}"}) as c:
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


# ---------------------------------------------------------------------------
# Auth (Phase 3.0 Stage A)
# ---------------------------------------------------------------------------


class TestAuth:
    """Verify Bearer + scope enforcement on the API."""

    @pytest.fixture()
    def unauth_client(self, tmp_path: Path) -> Generator[TestClient]:
        """A second client WITHOUT the admin header — to assert 401s."""
        db = tmp_path / "noauth.db"
        engine = make_engine(f"sqlite:///{db}")
        Base.metadata.create_all(engine)
        factory = make_session_factory(engine)
        app = create_app(factory)
        with TestClient(app) as c:
            yield c
        engine.dispose()

    def test_health_remains_open(self, unauth_client: TestClient) -> None:
        assert unauth_client.get("/health").status_code == 200

    def test_no_auth_returns_401(self, unauth_client: TestClient) -> None:
        for path, method in [
            ("/projects", "GET"),
            ("/projects", "POST"),
            ("/tokens", "GET"),
            ("/events", "GET"),
        ]:
            kwargs = {"json": {"name": "x", "root_path": "/tmp/y"}} if method == "POST" else {}
            r = unauth_client.request(method, path, **kwargs)
            assert r.status_code == 401, f"{method} {path} should require auth"

    def test_invalid_bearer_returns_401(self, unauth_client: TestClient) -> None:
        r = unauth_client.get(
            "/projects", headers={"Authorization": "Bearer gfp_definitely_not_real"}
        )
        assert r.status_code == 401

    def test_admin_can_create_scoped_token(self, client: TestClient) -> None:
        r = client.post(
            "/tokens",
            json={
                "label": "claude-laptop",
                "agent_type": "claude",
                "scopes": ["decisions:write", "reviews:read"],
            },
        )
        assert r.status_code == 201
        body = r.json()
        assert body["secret"].startswith("gfp_")
        assert body["token"]["label"] == "claude-laptop"
        assert "decisions:write" in body["token"]["scopes_csv"]

    def test_scoped_token_is_blocked_outside_its_scope(
        self, client: TestClient, tmp_path: Path
    ) -> None:
        # Create a token with ONLY reviews:read.
        r = client.post(
            "/tokens",
            json={
                "label": "narrow",
                "agent_type": "codex",
                "scopes": ["reviews:read"],
            },
        )
        narrow_secret = r.json()["secret"]
        narrow = {"Authorization": f"Bearer {narrow_secret}"}

        # Same app/DB, but using the narrow token via direct request().
        from urllib.parse import urlsplit  # noqa: PLC0415

        base = urlsplit(str(client.base_url))
        # We can reuse `client` — it's just an HTTP client.
        assert (
            client.get("/projects", headers=narrow).status_code == 403
        )  # missing projects:read
        assert (
            client.get(
                f"{base.scheme}://{base.netloc}/reviews",
                params={"project_path": "/nope"},
                headers=narrow,
            ).status_code
            == 404
        )  # reviews:read present, project not found

    def test_revoked_token_returns_401(self, client: TestClient) -> None:
        # Create a token, then revoke it, then try to use it.
        created = client.post(
            "/tokens",
            json={
                "label": "to-revoke",
                "agent_type": "human",
                "scopes": ["projects:read"],
            },
        ).json()
        secret = created["secret"]
        token_id = created["token"]["id"]

        # Use it once successfully.
        assert (
            client.get("/projects", headers={"Authorization": f"Bearer {secret}"}).status_code
            == 200
        )

        # Revoke it (admin scope on the fixture token).
        revoke = client.delete(f"/tokens/{token_id}")
        assert revoke.status_code == 204

        # Now it should be 401.
        assert (
            client.get("/projects", headers={"Authorization": f"Bearer {secret}"}).status_code
            == 401
        )


# ---------------------------------------------------------------------------
# OAuth + sessions (Phase 3.0 Stage B)
# ---------------------------------------------------------------------------


class TestOAuth:
    """Verify the OAuth router 503s without creds, redirects with creds, and
    the session lifecycle works end-to-end (mocked GitHub API)."""

    @pytest.fixture()
    def fresh_app(self, tmp_path: Path) -> Generator[tuple[TestClient, object]]:
        """Bare app (no admin token) + the session factory for direct DB access."""
        db = tmp_path / "oauth.db"
        engine = make_engine(f"sqlite:///{db}")
        Base.metadata.create_all(engine)
        factory = make_session_factory(engine)
        app = create_app(factory)
        with TestClient(app) as c:
            yield c, factory
        engine.dispose()

    @pytest.fixture()
    def with_github_creds(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> Generator[None]:
        monkeypatch.setenv("GITHUB_OAUTH_CLIENT_ID", "test_client_id")
        monkeypatch.setenv("GITHUB_OAUTH_CLIENT_SECRET", "test_client_secret")
        monkeypatch.setenv("GOVFORGE_COOKIE_SECRET", "x" * 48)
        yield

    def test_github_start_503_without_creds(
        self, fresh_app: tuple[TestClient, object]
    ) -> None:
        c, _ = fresh_app
        assert c.get("/auth/github/start", follow_redirects=False).status_code == 503

    def test_google_503_without_creds(
        self, fresh_app: tuple[TestClient, object]
    ) -> None:
        c, _ = fresh_app
        assert c.get("/auth/google/start", follow_redirects=False).status_code == 503

    def test_magic_link_stub_503(
        self, fresh_app: tuple[TestClient, object]
    ) -> None:
        c, _ = fresh_app
        assert c.post("/auth/magic/request").status_code == 503

    @pytest.fixture()
    def with_google_creds(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> Generator[None]:
        monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_ID", "test_google_id")
        monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_SECRET", "test_google_secret")
        monkeypatch.setenv("GOVFORGE_COOKIE_SECRET", "x" * 48)
        yield

    def test_google_start_redirects_with_creds(
        self, fresh_app: tuple[TestClient, object], with_google_creds: None
    ) -> None:
        c, _ = fresh_app
        r = c.get("/auth/google/start", follow_redirects=False)
        assert r.status_code == 302
        loc = r.headers["location"]
        assert loc.startswith("https://accounts.google.com/o/oauth2/v2/auth")
        assert "client_id=test_google_id" in loc
        assert "response_type=code" in loc
        assert "scope=openid" in loc
        assert "state=" in loc
        cookie = r.headers.get("set-cookie", "")
        assert "govforge_oauth_state=" in cookie

    def test_google_callback_rejects_bad_state(
        self, fresh_app: tuple[TestClient, object], with_google_creds: None
    ) -> None:
        c, _ = fresh_app
        r = c.get(
            "/auth/google/callback",
            params={"code": "x", "state": "wrong"},
            follow_redirects=False,
        )
        assert r.status_code == 400

    def test_session_401_without_cookie(
        self, fresh_app: tuple[TestClient, object]
    ) -> None:
        c, _ = fresh_app
        assert c.get("/auth/session").status_code == 401

    def test_github_start_redirects_with_creds(
        self, fresh_app: tuple[TestClient, object], with_github_creds: None
    ) -> None:
        c, _ = fresh_app
        r = c.get("/auth/github/start", follow_redirects=False)
        assert r.status_code == 302
        loc = r.headers["location"]
        assert loc.startswith("https://github.com/login/oauth/authorize")
        assert "client_id=test_client_id" in loc
        assert "state=" in loc
        # The state cookie is also set so callback can verify CSRF.
        cookie = r.headers.get("set-cookie", "")
        assert "govforge_oauth_state=" in cookie

    def test_github_callback_rejects_bad_state(
        self, fresh_app: tuple[TestClient, object], with_github_creds: None
    ) -> None:
        c, _ = fresh_app
        # No state cookie set on the client → callback should reject.
        r = c.get(
            "/auth/github/callback",
            params={"code": "x", "state": "wrong"},
            follow_redirects=False,
        )
        assert r.status_code == 400

    def test_session_roundtrip_with_seeded_session(
        self,
        fresh_app: tuple[TestClient, object],
        with_github_creds: None,
    ) -> None:
        """Skip the OAuth handshake (network-dependent) and seed a User +
        Session directly, then verify the /auth/session cookie path works."""
        c, factory = fresh_app
        from govforge.api.auth import create_session_row, encode_session_cookie  # noqa: PLC0415

        with factory() as s:
            user = User(email="oauth-tester@local", display_name="Tester")
            s.add(user)
            s.flush()
            session_row = create_session_row(s, user_id=user.id)
            s.flush()
            sid = session_row.id
            uid = user.id
            s.commit()

        cookie_value = encode_session_cookie(sid)
        assert cookie_value is not None
        c.cookies.set("govforge_session", cookie_value)

        r = c.get("/auth/session")
        assert r.status_code == 200
        body = r.json()
        assert body["user"]["email"] == "oauth-tester@local"
        assert body["user"]["id"] == str(uid)

        # Logout revokes the session.
        assert c.post("/auth/logout").status_code == 204
        # Subsequent /auth/session reads should fail — the cookie still carries
        # the (now-revoked) session id, but resolve_session rejects revoked rows.
        c.cookies.set("govforge_session", cookie_value)
        assert c.get("/auth/session").status_code == 401

    def test_session_rejects_bad_signature(
        self,
        fresh_app: tuple[TestClient, object],
        with_github_creds: None,
    ) -> None:
        c, _ = fresh_app
        # Forged cookie — random uuid with a made-up signature.
        c.cookies.set(
            "govforge_session", "00000000-0000-0000-0000-000000000000.deadbeef"
        )
        assert c.get("/auth/session").status_code == 401
