"""MCP server context — plumbs DB session + entity resolution into tool handlers.

Tool handlers want to work with human-friendly identifiers (`TASK-001`, the
agent name `claude`, a repo path) rather than UUIDs. This module is the
boundary that translates those into ORM rows.

Each tool call opens a fresh session via `ServerContext.session()` so a
failed handler doesn't poison subsequent calls. Sessions are committed on
success and rolled back on exception.
"""

from __future__ import annotations

from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass

from sqlalchemy.orm import Session

from govforge.core.enums import AgentType
from govforge.core.models import Agent, Decision, Project, Review, Task

SessionFactory = Callable[[], Session]


@dataclass(frozen=True)
class ServerContext:
    """Dependencies handed to every tool/resource handler."""

    session_factory: SessionFactory

    @contextmanager
    def session(self) -> Iterator[Session]:
        s = self.session_factory()
        try:
            yield s
            s.commit()
        except Exception:
            s.rollback()
            raise
        finally:
            s.close()


# ---------------------------------------------------------------------------
# Agent resolution
# ---------------------------------------------------------------------------


def _agent_type_for_name(name: str) -> AgentType:
    """Best-effort mapping from a free-form agent name to an `AgentType`."""
    try:
        return AgentType(name.lower())
    except ValueError:
        return AgentType.HUMAN


def get_or_create_agent(session: Session, name: str) -> Agent:
    """Look up an agent by name; create one if missing.

    Type is inferred from the name (`claude` → CLAUDE, `codex` → CODEX, …)
    falling back to HUMAN for free-form names like `eric`.
    """
    existing = session.query(Agent).filter(Agent.name == name).one_or_none()
    if existing is not None:
        return existing
    agent = Agent(name=name, type=_agent_type_for_name(name))
    session.add(agent)
    session.flush()
    return agent


# ---------------------------------------------------------------------------
# Project / Task / Decision / Review resolution
# ---------------------------------------------------------------------------


class EntityNotFound(Exception):
    """Raised when an MCP-supplied identifier doesn't resolve."""


def resolve_project(session: Session, project_path: str) -> Project:
    project = session.query(Project).filter(Project.root_path == project_path).one_or_none()
    if project is None:
        raise EntityNotFound(f"no project registered at {project_path!r}")
    return project


def resolve_task(session: Session, *, display_id: str, project_id: object | None = None) -> Task:
    q = session.query(Task).filter(Task.display_id == display_id)
    if project_id is not None:
        q = q.filter(Task.project_id == project_id)
    task = q.one_or_none()
    if task is None:
        raise EntityNotFound(f"task not found: {display_id}")
    return task


def resolve_decision(
    session: Session, *, display_id: str, project_id: object | None = None
) -> Decision:
    q = session.query(Decision).filter(Decision.display_id == display_id)
    if project_id is not None:
        q = q.filter(Decision.project_id == project_id)
    decision = q.one_or_none()
    if decision is None:
        raise EntityNotFound(f"decision not found: {display_id}")
    return decision


def resolve_review(session: Session, *, display_id: str) -> Review:
    review = session.query(Review).filter(Review.display_id == display_id).one_or_none()
    if review is None:
        raise EntityNotFound(f"review not found: {display_id}")
    return review


__all__ = [
    "EntityNotFound",
    "ServerContext",
    "SessionFactory",
    "get_or_create_agent",
    "resolve_decision",
    "resolve_project",
    "resolve_review",
    "resolve_task",
]
