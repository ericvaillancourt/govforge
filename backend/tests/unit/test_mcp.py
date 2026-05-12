"""Integration tests for the FastMCP server.

Pattern: build the server in-process against an in-memory SQLite DB and
drive it through `fastmcp.Client`. Each test exercises one tool or one
end-to-end workflow segment.

The full Claude → Codex → disagreement → approval flow lives in
`test_full_workflow_via_mcp`.
"""

from __future__ import annotations

import asyncio
import json
import subprocess
from collections.abc import Generator
from pathlib import Path

import pytest
from fastmcp import Client, FastMCP
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker

from govforge.core.models import Base, Project
from govforge.db.session import make_engine, make_session_factory
from govforge.mcp.server import build_server

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def engine(tmp_path: Path) -> Generator[Engine]:
    # File-backed SQLite so multiple connections (test fixture + tool sessions)
    # see the same database. `:memory:` is connection-local without StaticPool.
    db = tmp_path / "mcp.db"
    e = make_engine(f"sqlite:///{db}")
    Base.metadata.create_all(e)
    try:
        yield e
    finally:
        e.dispose()


@pytest.fixture()
def factory(engine: Engine) -> sessionmaker:
    return make_session_factory(engine)


@pytest.fixture()
def server(factory: sessionmaker) -> FastMCP:
    return build_server(factory)


def _run_git(cwd: Path, *args: str) -> None:
    subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True)


@pytest.fixture()
def git_repo(tmp_path: Path) -> Path:
    """A git repo with one commit touching auth-adjacent files."""
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


@pytest.fixture()
def project(factory: sessionmaker, git_repo: Path) -> Project:
    """Pre-seed a Project at the temp git repo path so resolve_project works."""
    s = factory()
    p = Project(name="t", root_path=str(git_repo))
    s.add(p)
    s.commit()
    s.refresh(p)
    s.close()
    return p


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _run(coro):  # type: ignore[no-untyped-def]
    """Run an async coroutine on a fresh event loop (for sync pytest tests)."""
    return asyncio.get_event_loop().run_until_complete(coro) if False else asyncio.run(coro)


async def _data(client: Client, name: str, args: dict) -> dict:  # type: ignore[type-arg]
    """Call a tool, return its result as a plain dict.

    FastMCP wraps the structured response in an auto-generated Pydantic model;
    the raw JSON is in `result.content[0].text`. We parse that for stable
    dict-style assertions.
    """
    result = await client.call_tool(name, args)
    if result.is_error:
        raise AssertionError(f"tool {name} errored: {result.content}")
    assert result.content, f"tool {name} returned no content"
    text = getattr(result.content[0], "text", None)
    assert text is not None, f"tool {name} returned non-text content"
    return json.loads(text)  # type: ignore[no-any-return]


# ---------------------------------------------------------------------------
# Discovery
# ---------------------------------------------------------------------------


class TestDiscovery:
    def test_lists_all_tools(self, server: FastMCP) -> None:
        async def go() -> list[str]:
            async with Client(server) as c:
                tools = await c.list_tools()
                return [t.name for t in tools]

        names = _run(go())
        assert set(names) == {
            "create_task",
            "record_decision",
            "attach_git_diff",
            "run_policy_checks",
            "request_review",
            "submit_review",
            "record_disagreement",
            "approve_decision",
            "get_decision_context",
            "list_open_reviews",
            "list_pending_approvals",
        }

    def test_lists_all_resources_and_prompts(self, server: FastMCP) -> None:
        async def go() -> tuple[list[str], list[str]]:
            async with Client(server) as c:
                tmpls = await c.list_resource_templates()
                prompts = await c.list_prompts()
                return [t.uriTemplate for t in tmpls], [p.name for p in prompts]

        uris, prompts = _run(go())
        assert set(uris) == {
            "govforge://project/{project_id}/policies",
            "govforge://decision/{decision_id}",
            "govforge://task/{task_id}/timeline",
            "govforge://review/{review_id}",
            "govforge://project/{project_id}/conventions",
        }
        assert set(prompts) == {
            "review_code_decision",
            "explain_disagreement",
            "summarize_decision",
        }


# ---------------------------------------------------------------------------
# Single-tool tests
# ---------------------------------------------------------------------------


class TestCreateTask:
    def test_creates_with_display_id(self, server: FastMCP, project: Project) -> None:
        async def go() -> dict:  # type: ignore[type-arg]
            async with Client(server) as c:
                return await _data(
                    c,
                    "create_task",
                    {
                        "project_path": project.root_path,
                        "title": "Refactor auth",
                        "risk_level": "high",
                        "actor_agent": "claude",
                    },
                )

        out = _run(go())
        assert out["task_id"] == "TASK-001"
        assert out["status"] == "open"

    def test_unknown_project_errors(self, server: FastMCP) -> None:
        async def go() -> bool:
            async with Client(server) as c:
                r = await c.call_tool(
                    "create_task",
                    {"project_path": "/nope", "title": "x"},
                    raise_on_error=False,
                )
                return r.is_error

        assert _run(go()) is True


# ---------------------------------------------------------------------------
# Full workflow
# ---------------------------------------------------------------------------


class TestFullWorkflow:
    def test_claude_codex_disagreement_approval(
        self, server: FastMCP, project: Project, git_repo: Path
    ) -> None:
        """Walk the canonical flow: Claude proposes → policies → Codex reviews →
        disagreement → human approves."""

        async def go() -> dict:  # type: ignore[type-arg]
            async with Client(server) as c:
                task = await _data(
                    c,
                    "create_task",
                    {
                        "project_path": project.root_path,
                        "title": "Migrate session auth to signed cookies",
                        "risk_level": "high",
                        "actor_agent": "claude",
                    },
                )
                decision = await _data(
                    c,
                    "record_decision",
                    {
                        "task_id": task["task_id"],
                        "author_agent": "claude",
                        "title": "Migrate session auth",
                        "summary": "Replace server-side session lookup with signed cookies",
                        "rationale": "Reduce DB roundtrips",
                        "risk_level": "high",
                    },
                )
                git = await _data(
                    c,
                    "attach_git_diff",
                    {
                        "decision_id": decision["decision_id"],
                        "repo_path": str(git_repo),
                        "commit_hash": "HEAD",
                        "actor_agent": "claude",
                    },
                )
                policy = await _data(
                    c,
                    "run_policy_checks",
                    {"decision_id": decision["decision_id"], "actor_agent": "claude"},
                )
                review_req = await _data(
                    c,
                    "request_review",
                    {
                        "decision_id": decision["decision_id"],
                        "reviewer_agent": "codex",
                        "focus": ["security", "tests"],
                    },
                )
                review = await _data(
                    c,
                    "submit_review",
                    {
                        "decision_id": decision["decision_id"],
                        "reviewer_agent": "codex",
                        "status": "changes_requested",
                        "summary": "Session fixation risk",
                        "findings": [
                            {
                                "severity": "high",
                                "category": "security",
                                "file_path": "auth.py",
                                "message": "Token not rotated after login",
                                "recommendation": "Rotate after successful login",
                            }
                        ],
                    },
                )
                disagreement = await _data(
                    c,
                    "record_disagreement",
                    {
                        "decision_id": decision["decision_id"],
                        "topic": "session security",
                        "author_position": "Signed cookies are safe",
                        "reviewer_position": "Need rotation",
                        "requires_human_decision": True,
                    },
                )
                approval = await _data(
                    c,
                    "approve_decision",
                    {
                        "decision_id": decision["decision_id"],
                        "approver": "eric",
                        "status": "approved",
                        "comment": "OK after rotation patch",
                    },
                )
                ctx = await _data(
                    c,
                    "get_decision_context",
                    {"decision_id": decision["decision_id"]},
                )
                return {
                    "task": task,
                    "decision": decision,
                    "git": git,
                    "policy": policy,
                    "review_req": review_req,
                    "review": review,
                    "disagreement": disagreement,
                    "approval": approval,
                    "context": ctx,
                }

        r = _run(go())
        assert r["task"]["task_id"] == "TASK-001"
        assert r["decision"]["decision_id"] == "DEC-001"
        assert "auth.py" in r["git"]["files_changed"]
        # auth_change_requires_review must have flagged the diff
        names = {entry["policy"] for entry in r["policy"]["results"]}
        assert "auth_change_requires_review" in names
        statuses = {entry["status"] for entry in r["policy"]["results"]}
        assert "blocked" in statuses
        # request_review moved decision to REVIEW_REQUIRED before submit
        assert r["review_req"]["status"] == "review_required"
        # CHANGES_REQUESTED review pushes decision back
        assert r["review"]["decision_status"] == "changes_requested"
        assert r["disagreement"]["requires_human_decision"] is True
        # approval finalises
        assert r["approval"]["decision_status"] == "approved"
        assert r["approval"]["approval_status"] == "approved"
        # Context aggregates everything
        assert r["context"]["decision"]["status"] == "approved"
        assert len(r["context"]["reviews"]) == 1
        assert len(r["context"]["disagreements"]) == 1
        assert len(r["context"]["approvals"]) == 1
        # Timeline includes the review submission event
        event_types = {e["type"] for e in r["context"]["events"]}
        assert "decision.created" in event_types
        assert "review.submitted" in event_types
        assert "decision.approved" in event_types


# ---------------------------------------------------------------------------
# Resources
# ---------------------------------------------------------------------------


class TestResources:
    def test_decision_resource_after_workflow(
        self, server: FastMCP, project: Project, git_repo: Path
    ) -> None:
        async def go() -> dict:  # type: ignore[type-arg]
            async with Client(server) as c:
                task = await _data(
                    c,
                    "create_task",
                    {"project_path": project.root_path, "title": "x"},
                )
                decision = await _data(
                    c,
                    "record_decision",
                    {
                        "task_id": task["task_id"],
                        "author_agent": "claude",
                        "title": "x",
                    },
                )
                contents = await c.read_resource(f"govforge://decision/{decision['decision_id']}")
                assert contents, "expected at least one resource content"
                return json.loads(contents[0].text)

        data = _run(go())
        assert data["id"] == "DEC-001"
        assert data["status"] == "draft"

    def test_project_policies_resource(
        self, server: FastMCP, project: Project, git_repo: Path
    ) -> None:
        async def go() -> dict:  # type: ignore[type-arg]
            async with Client(server) as c:
                # Run policies once so PolicyService syncs the registry
                task = await _data(
                    c,
                    "create_task",
                    {"project_path": project.root_path, "title": "x"},
                )
                decision = await _data(
                    c,
                    "record_decision",
                    {
                        "task_id": task["task_id"],
                        "author_agent": "claude",
                        "title": "x",
                    },
                )
                await _data(
                    c,
                    "attach_git_diff",
                    {
                        "decision_id": decision["decision_id"],
                        "repo_path": str(git_repo),
                    },
                )
                await _data(
                    c,
                    "run_policy_checks",
                    {"decision_id": decision["decision_id"]},
                )
                contents = await c.read_resource(f"govforge://project/{project.id}/policies")
                return json.loads(contents[0].text)

        data = _run(go())
        names = {p["name"] for p in data["policies"]}
        assert "auth_change_requires_review" in names
        assert "secret_pattern_detection" in names


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------


class TestPrompts:
    def test_review_code_decision_renders(self, server: FastMCP) -> None:
        async def go() -> str:
            async with Client(server) as c:
                msg = await c.get_prompt(
                    "review_code_decision",
                    {"decision_id": "DEC-001"},
                )
                return msg.messages[0].content.text  # type: ignore[union-attr]

        text = _run(go())
        assert "DEC-001" in text
        assert "submit_review" in text


# ---------------------------------------------------------------------------
# Scoped tool registration (Phase 3.0 Stage C item A)
# ---------------------------------------------------------------------------
#
# When the MCP server is started with a scoped API token, `tools/list` must
# only expose tools whose required scope is in the token's scope list. This
# is what makes role-separated agents possible: a reviewer token literally
# cannot see the author tools.


def _list_tool_names(server: FastMCP) -> set[str]:
    async def go() -> set[str]:
        async with Client(server) as c:
            tools = await c.list_tools()
            return {t.name for t in tools}

    return _run(go())


class TestScopedToolRegistration:
    def test_scopes_none_exposes_every_tool(self, factory: sessionmaker) -> None:
        """No token configured → back-compat: every tool registered."""
        server = build_server(factory, scopes=None)
        assert len(_list_tool_names(server)) == 11

    def test_admin_scope_exposes_every_tool(self, factory: sessionmaker) -> None:
        from govforge.core.enums import TokenScope

        server = build_server(factory, scopes={TokenScope.ADMIN})
        assert len(_list_tool_names(server)) == 11

    def test_reviewer_scopes_expose_only_review_tools(
        self, factory: sessionmaker
    ) -> None:
        from govforge.core.enums import TokenScope

        server = build_server(
            factory,
            scopes={
                TokenScope.REVIEWS_WRITE,
                TokenScope.REVIEWS_READ,
                TokenScope.DECISIONS_READ,
            },
        )
        assert _list_tool_names(server) == {
            "request_review",
            "submit_review",
            "record_disagreement",
            "list_open_reviews",
            "get_decision_context",
        }

    def test_author_scopes_expose_only_author_tools(
        self, factory: sessionmaker
    ) -> None:
        from govforge.core.enums import TokenScope

        server = build_server(
            factory,
            scopes={
                TokenScope.TASKS_WRITE,
                TokenScope.DECISIONS_WRITE,
                TokenScope.DECISIONS_READ,
            },
        )
        assert _list_tool_names(server) == {
            "create_task",
            "record_decision",
            "attach_git_diff",
            "run_policy_checks",
            "get_decision_context",
        }

    def test_approver_scopes_expose_only_approver_tools(
        self, factory: sessionmaker
    ) -> None:
        from govforge.core.enums import TokenScope

        server = build_server(
            factory,
            scopes={
                TokenScope.APPROVALS_WRITE,
                TokenScope.APPROVALS_READ,
                TokenScope.DECISIONS_READ,
            },
        )
        assert _list_tool_names(server) == {
            "approve_decision",
            "list_pending_approvals",
            "get_decision_context",
        }

    def test_empty_scopes_expose_no_tools(self, factory: sessionmaker) -> None:
        """Invalid/revoked token → empty set → no tools registered."""
        server = build_server(factory, scopes=set())
        assert _list_tool_names(server) == set()


class TestEnumDiscoverability:
    """Stage C item D — agents must be able to discover valid enum values from
    the tool schema/description, not by trial-and-error on a Pydantic error."""

    def test_submit_review_advertises_finding_category_values(
        self, server: FastMCP
    ) -> None:
        async def go() -> tuple[str | None, dict]:
            async with Client(server) as c:
                for t in await c.list_tools():
                    if t.name == "submit_review":
                        return t.description, t.inputSchema
                return None, {}

        desc, schema = _run(go())
        assert desc is not None
        # tool-level docstring lists the categories in prose
        for value in ("security", "performance", "docs", "accessibility"):
            assert value in desc, f"{value!r} should appear in submit_review description"
        # nested schema lists them as an enum constraint
        finding_props = schema["properties"]["findings"]["anyOf"][0]["items"]["properties"]
        assert set(finding_props["category"]["enum"]) == {
            "security",
            "performance",
            "architecture",
            "bug",
            "maintainability",
            "tests",
            "docs",
            "accessibility",
        }
        assert "docs" in finding_props["category"]["description"]

    def test_approve_decision_advertises_status_values(self, server: FastMCP) -> None:
        async def go() -> tuple[str | None, dict]:
            async with Client(server) as c:
                for t in await c.list_tools():
                    if t.name == "approve_decision":
                        return t.description, t.inputSchema
                return None, {}

        desc, schema = _run(go())
        assert desc is not None
        for value in ("approved", "rejected", "needs_changes"):
            assert value in desc
        assert set(schema["properties"]["status"]["enum"]) == {
            "approved",
            "rejected",
            "needs_changes",
        }


class TestResolveScopes:
    """End-to-end check of `resolve_scopes`: env token → DB lookup → scope set."""

    def test_no_env_returns_none(
        self, factory: sessionmaker, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        from govforge.mcp.server import resolve_scopes

        monkeypatch.delenv("GOVFORGE_API_TOKEN", raising=False)
        monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path))  # empty config dir
        assert resolve_scopes(factory) is None

    def test_invalid_token_returns_empty(
        self, factory: sessionmaker, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        from govforge.mcp.server import resolve_scopes

        monkeypatch.setenv("GOVFORGE_API_TOKEN", "gfp_doesnotexist00000000000000000")
        monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path))
        assert resolve_scopes(factory) == set()

    def test_valid_token_returns_its_scopes(
        self, factory: sessionmaker, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        from govforge.api.auth import (
            extract_prefix,
            generate_token_secret,
            hash_token_secret,
        )
        from govforge.core.enums import AgentType, TokenScope
        from govforge.core.models import ApiToken, User
        from govforge.mcp.server import resolve_scopes

        secret = generate_token_secret()
        s = factory()
        user = User(email="reviewer@example.com", display_name="Reviewer")
        s.add(user)
        s.flush()
        token = ApiToken(
            user_id=user.id,
            label="codex-reviewer",
            agent_type=AgentType.CODEX,
            prefix=extract_prefix(secret),
            hashed_secret=hash_token_secret(secret),
            scopes_csv=f"{TokenScope.REVIEWS_WRITE.value},{TokenScope.DECISIONS_READ.value}",
        )
        s.add(token)
        s.commit()
        s.close()

        monkeypatch.setenv("GOVFORGE_API_TOKEN", secret)
        monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path))
        assert resolve_scopes(factory) == {
            TokenScope.REVIEWS_WRITE,
            TokenScope.DECISIONS_READ,
        }
