"""MCP resources — read-only context handles, addressed by URI.

Phase-1 resources (devis.md §11.1):

- ``govforge://project/{project_id}/policies``     active policies
- ``govforge://decision/{decision_id}``            full decision payload
- ``govforge://task/{task_id}/timeline``           event timeline for a task
- ``govforge://review/{review_id}``                full review payload
- ``govforge://project/{project_id}/conventions``  project conventions (empty in P1)

`project_id` is the project's UUID (stable). Decision / task / review use
their display IDs (`DEC-001`, `TASK-001`, `REV-001`).
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastmcp import FastMCP
from sqlalchemy.orm import Session

from govforge.core.models import Policy, Project
from govforge.core.services import TimelineService
from govforge.mcp.context import (
    EntityNotFound,
    ServerContext,
    resolve_decision,
    resolve_review,
    resolve_task,
)


def _project_or_404(session: Session, project_id: str) -> Project:
    try:
        uid = UUID(project_id)
    except ValueError as e:
        raise EntityNotFound(f"invalid project_id: {project_id}") from e
    project = session.get(Project, uid)
    if project is None:
        raise EntityNotFound(f"project not found: {project_id}")
    return project


def register_resources(server: FastMCP, ctx: ServerContext) -> None:
    """Attach every resource handler to the given FastMCP instance."""

    # ------------------------------------------------------------------
    # govforge://project/{project_id}/policies
    # ------------------------------------------------------------------
    @server.resource("govforge://project/{project_id}/policies")
    def project_policies(project_id: str) -> dict[str, Any]:
        with ctx.session() as session:
            project = _project_or_404(session, project_id)
            rows = (
                session.query(Policy)
                .filter(Policy.enabled.is_(True))
                .order_by(Policy.name.asc())
                .all()
            )
            return {
                "project_id": str(project.id),
                "policies": [
                    {
                        "name": row.name,
                        "description": row.description,
                        "severity": row.severity.value,
                        "config": dict(row.config_json) if row.config_json else {},
                    }
                    for row in rows
                ],
            }

    # ------------------------------------------------------------------
    # govforge://decision/{decision_id}
    # ------------------------------------------------------------------
    @server.resource("govforge://decision/{decision_id}")
    def decision_resource(decision_id: str) -> dict[str, Any]:
        with ctx.session() as session:
            decision = resolve_decision(session, display_id=decision_id)
            git_changes = sorted(decision.git_changes, key=lambda g: g.created_at)
            latest_git = git_changes[-1] if git_changes else None
            return {
                "id": decision.display_id,
                "uuid": str(decision.id),
                "title": decision.title,
                "status": decision.status.value,
                "risk_level": decision.risk_level.value,
                "summary": decision.summary,
                "rationale": decision.rationale,
                "human_approval_required": decision.human_approval_required,
                "git_change": (
                    {
                        "commit_hash": latest_git.commit_hash,
                        "branch_name": latest_git.branch_name,
                        "files_changed": list(latest_git.files_changed_json or []),
                        "insertions": latest_git.insertions or 0,
                        "deletions": latest_git.deletions or 0,
                        "diff_hash": latest_git.diff_hash,
                    }
                    if latest_git is not None
                    else None
                ),
                "reviews": [
                    {
                        "id": r.display_id,
                        "status": r.status.value,
                        "summary": r.summary,
                        "findings": [
                            {
                                "severity": f.severity.value,
                                "category": f.category.value,
                                "file_path": f.file_path,
                                "line_start": f.line_start,
                                "line_end": f.line_end,
                                "message": f.message,
                                "recommendation": f.recommendation,
                            }
                            for f in r.findings
                        ],
                    }
                    for r in sorted(decision.reviews, key=lambda r: r.created_at)
                ],
                "policy_results": [
                    {
                        "status": p.status.value,
                        "message": p.message,
                        "evidence": dict(p.evidence_json) if p.evidence_json else {},
                    }
                    for p in sorted(decision.policy_results, key=lambda r: r.created_at)
                ],
                "disagreements": [
                    {
                        "id": str(d.id),
                        "topic": d.topic,
                        "author_position": d.author_position,
                        "reviewer_position": d.reviewer_position,
                        "risk_summary": d.risk_summary,
                        "requires_human_decision": d.requires_human_decision,
                        "resolution": d.resolution,
                    }
                    for d in sorted(decision.disagreements, key=lambda d: d.created_at)
                ],
                "approvals": [
                    {
                        "id": str(a.id),
                        "status": a.status.value,
                        "comment": a.comment,
                    }
                    for a in sorted(decision.approvals, key=lambda a: a.created_at)
                ],
            }

    # ------------------------------------------------------------------
    # govforge://task/{task_id}/timeline
    # ------------------------------------------------------------------
    @server.resource("govforge://task/{task_id}/timeline")
    def task_timeline(task_id: str) -> dict[str, Any]:
        with ctx.session() as session:
            task = resolve_task(session, display_id=task_id)
            events = TimelineService(session).for_task(task.id)
            return {
                "task_id": task.display_id,
                "events": [
                    {
                        "type": e.event_type,
                        "entity_type": e.entity_type,
                        "created_at": e.created_at.isoformat(),
                        "payload": dict(e.payload_json) if e.payload_json else {},
                    }
                    for e in events
                ],
            }

    # ------------------------------------------------------------------
    # govforge://review/{review_id}
    # ------------------------------------------------------------------
    @server.resource("govforge://review/{review_id}")
    def review_resource(review_id: str) -> dict[str, Any]:
        with ctx.session() as session:
            review = resolve_review(session, display_id=review_id)
            return {
                "id": review.display_id,
                "decision_id": review.decision.display_id,
                "status": review.status.value,
                "summary": review.summary,
                "findings": [
                    {
                        "severity": f.severity.value,
                        "category": f.category.value,
                        "file_path": f.file_path,
                        "line_start": f.line_start,
                        "line_end": f.line_end,
                        "message": f.message,
                        "recommendation": f.recommendation,
                    }
                    for f in review.findings
                ],
            }

    # ------------------------------------------------------------------
    # govforge://project/{project_id}/conventions
    # ------------------------------------------------------------------
    @server.resource("govforge://project/{project_id}/conventions")
    def project_conventions(project_id: str) -> dict[str, Any]:
        """Project conventions — placeholder for Phase 1.

        Phase 1 stores no convention data; this resource exists so the URI
        contract is stable. Returns an empty list. A future workstream will
        wire this to a Convention model + storage.
        """
        with ctx.session() as session:
            project = _project_or_404(session, project_id)
            return {
                "project_id": str(project.id),
                "conventions": [],
            }


__all__ = ["register_resources"]
