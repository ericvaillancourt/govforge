"""MCP tools — register the 11 phase-1 tools onto a FastMCP server.

Tool parameters are exposed as individual typed arguments so the published
JSON schema matches the flat shapes in `devis.md` §10.2 (no `payload`
wrapper). Each tool:

- opens a fresh DB session via :meth:`ServerContext.session`,
- delegates to a service in :mod:`govforge.core.services`,
- returns a Pydantic output model that FastMCP serializes to JSON.

Tools never run shell commands or write to Git (devis.md §10.1).
"""

from __future__ import annotations

from fastmcp import FastMCP

from govforge.core.enums import (
    ApprovalStatus,
    DecisionStatus,
    FindingSeverity,
    PolicyResultStatus,
    ReviewStatus,
    RiskLevel,
)
from govforge.core.services import (
    ApprovalService,
    DecisionService,
    DisagreementService,
    FindingInput,
    PolicyService,
    ReviewService,
    TaskService,
    TimelineService,
)
from govforge.mcp.context import (
    ServerContext,
    get_or_create_agent,
    resolve_decision,
    resolve_project,
    resolve_task,
)
from govforge.mcp.schemas import (
    ApproveDecisionOutput,
    AttachGitDiffOutput,
    CreateTaskOutput,
    GetDecisionContextOutput,
    ListOpenReviewsOutput,
    ListPendingApprovalsOutput,
    OpenReviewEntry,
    PendingApprovalEntry,
    PolicyResultEntry,
    RecordDecisionOutput,
    RecordDisagreementOutput,
    RequestReviewOutput,
    RunPolicyChecksOutput,
    SubmitReviewFinding,
    SubmitReviewOutput,
)


def register_tools(server: FastMCP, ctx: ServerContext) -> None:
    """Attach every tool handler to the given FastMCP instance."""

    # ------------------------------------------------------------------
    # create_task
    # ------------------------------------------------------------------
    @server.tool(name="create_task")
    def create_task(
        project_path: str,
        title: str,
        description: str | None = None,
        risk_level: RiskLevel = RiskLevel.MEDIUM,
        actor_agent: str | None = None,
    ) -> CreateTaskOutput:
        """Create a Task on the project at `project_path`."""
        with ctx.session() as session:
            project = resolve_project(session, project_path)
            actor = get_or_create_agent(session, actor_agent) if actor_agent else None
            task = TaskService(session).create(
                project_id=project.id,
                title=title,
                description=description,
                risk_level=risk_level,
                created_by_agent_id=actor.id if actor else None,
            )
            return CreateTaskOutput(task_id=task.display_id, status=task.status.value)

    # ------------------------------------------------------------------
    # record_decision
    # ------------------------------------------------------------------
    @server.tool(name="record_decision")
    def record_decision(
        task_id: str,
        author_agent: str,
        title: str,
        summary: str | None = None,
        rationale: str | None = None,
        risk_level: RiskLevel = RiskLevel.MEDIUM,
        human_approval_required: bool = False,
    ) -> RecordDecisionOutput:
        """Create a Decision linked to a Task. The Task's project is inherited."""
        with ctx.session() as session:
            task = resolve_task(session, display_id=task_id)
            author = get_or_create_agent(session, author_agent)
            decision = DecisionService(session).create(
                project_id=task.project_id,
                task_id=task.id,
                author_agent_id=author.id,
                title=title,
                summary=summary,
                rationale=rationale,
                risk_level=risk_level,
                human_approval_required=human_approval_required,
            )
            return RecordDecisionOutput(
                decision_id=decision.display_id,
                status=decision.status.value,
            )

    # ------------------------------------------------------------------
    # attach_git_diff
    # ------------------------------------------------------------------
    @server.tool(name="attach_git_diff")
    def attach_git_diff(
        decision_id: str,
        repo_path: str,
        commit_hash: str = "HEAD",
        actor_agent: str | None = None,
    ) -> AttachGitDiffOutput:
        """Run the Git extractor and persist a GitChange linked to the decision."""
        with ctx.session() as session:
            decision = resolve_decision(session, display_id=decision_id)
            actor = get_or_create_agent(session, actor_agent) if actor_agent else None
            gc = DecisionService(session).attach_git(
                decision_id=decision.id,
                repo_path=repo_path,
                rev=commit_hash,
                actor_agent_id=actor.id if actor else None,
            )
            return AttachGitDiffOutput(
                decision_id=decision.display_id,
                files_changed=list(gc.files_changed_json or []),
                insertions=gc.insertions or 0,
                deletions=gc.deletions or 0,
                diff_hash=gc.diff_hash or "",
            )

    # ------------------------------------------------------------------
    # run_policy_checks
    # ------------------------------------------------------------------
    @server.tool(name="run_policy_checks")
    def run_policy_checks(
        decision_id: str,
        config_path: str | None = None,
        actor_agent: str | None = None,
    ) -> RunPolicyChecksOutput:
        """Evaluate policies for a decision; persist results + bump status if BLOCKED."""
        with ctx.session() as session:
            decision = resolve_decision(session, display_id=decision_id)
            actor = get_or_create_agent(session, actor_agent) if actor_agent else None
            results = PolicyService(session).run_for_decision(
                decision_id=decision.id,
                config_path=config_path,
                actor_agent_id=actor.id if actor else None,
            )

            from govforge.core.models import Policy as PolicyRow

            names_by_id = {
                row.id: row.name
                for row in session.query(PolicyRow)
                .filter(PolicyRow.id.in_({r.policy_id for r in results}))
                .all()
            }

            entries = [
                PolicyResultEntry(
                    policy=names_by_id.get(r.policy_id, "unknown"),
                    status=r.status,
                    message=r.message or "",
                )
                for r in results
            ]
            blocked = any(r.status == PolicyResultStatus.BLOCKED for r in results)
            if blocked and decision.status == DecisionStatus.DRAFT:
                DecisionService(session).update_status(
                    decision_id=decision.id,
                    status=DecisionStatus.REVIEW_REQUIRED,
                    actor_agent_id=actor.id if actor else None,
                )
            return RunPolicyChecksOutput(
                decision_status=decision.status.value,
                results=entries,
            )

    # ------------------------------------------------------------------
    # request_review
    # ------------------------------------------------------------------
    @server.tool(name="request_review")
    def request_review(
        decision_id: str,
        reviewer_agent: str,
        focus: list[str] | None = None,
        actor_agent: str | None = None,
    ) -> RequestReviewOutput:
        """Mark a decision as REVIEW_REQUIRED and emit an event for the reviewer."""
        with ctx.session() as session:
            decision = resolve_decision(session, display_id=decision_id)
            reviewer = get_or_create_agent(session, reviewer_agent)
            actor = get_or_create_agent(session, actor_agent) if actor_agent else None
            updated = ReviewService(session).request(
                decision_id=decision.id,
                reviewer_agent_id=reviewer.id,
                focus=focus or [],
                actor_agent_id=actor.id if actor else None,
            )
            return RequestReviewOutput(
                decision_id=decision.display_id,
                status=updated.status.value,
            )

    # ------------------------------------------------------------------
    # submit_review
    # ------------------------------------------------------------------
    @server.tool(name="submit_review")
    def submit_review(
        decision_id: str,
        reviewer_agent: str,
        status: ReviewStatus,
        summary: str | None = None,
        findings: list[SubmitReviewFinding] | None = None,
    ) -> SubmitReviewOutput:
        """Record a Review with structured findings; updates decision status if needed."""
        with ctx.session() as session:
            decision = resolve_decision(session, display_id=decision_id)
            reviewer = get_or_create_agent(session, reviewer_agent)
            finding_inputs = [
                FindingInput(
                    severity=FindingSeverity(f.severity),
                    category=f.category,
                    file_path=f.file_path,
                    line_start=f.line_start,
                    line_end=f.line_end,
                    message=f.message,
                    recommendation=f.recommendation,
                )
                for f in findings or []
            ]
            review = ReviewService(session).submit(
                decision_id=decision.id,
                reviewer_agent_id=reviewer.id,
                status=status,
                summary=summary,
                findings=finding_inputs,
            )
            session.refresh(decision)
            return SubmitReviewOutput(
                review_id=review.display_id,
                decision_id=decision.display_id,
                decision_status=decision.status.value,
            )

    # ------------------------------------------------------------------
    # record_disagreement
    # ------------------------------------------------------------------
    @server.tool(name="record_disagreement")
    def record_disagreement(
        decision_id: str,
        topic: str,
        author_position: str | None = None,
        reviewer_position: str | None = None,
        risk_summary: str | None = None,
        requires_human_decision: bool = True,
        actor_agent: str | None = None,
    ) -> RecordDisagreementOutput:
        """Create a structured Disagreement on a decision."""
        with ctx.session() as session:
            decision = resolve_decision(session, display_id=decision_id)
            actor = get_or_create_agent(session, actor_agent) if actor_agent else None
            d = DisagreementService(session).record(
                decision_id=decision.id,
                topic=topic,
                author_position=author_position,
                reviewer_position=reviewer_position,
                risk_summary=risk_summary,
                requires_human_decision=requires_human_decision,
                actor_agent_id=actor.id if actor else None,
            )
            return RecordDisagreementOutput(
                disagreement_id=str(d.id),
                decision_id=decision.display_id,
                requires_human_decision=d.requires_human_decision,
            )

    # ------------------------------------------------------------------
    # approve_decision
    # ------------------------------------------------------------------
    @server.tool(name="approve_decision")
    def approve_decision(
        decision_id: str,
        approver: str,
        status: ApprovalStatus,
        comment: str | None = None,
    ) -> ApproveDecisionOutput:
        """Record a human approval/rejection/needs_changes verdict on a decision."""
        with ctx.session() as session:
            decision = resolve_decision(session, display_id=decision_id)
            approver_agent = get_or_create_agent(session, approver)
            svc = ApprovalService(session)
            if status == ApprovalStatus.APPROVED:
                approval = svc.approve(
                    decision_id=decision.id,
                    approver_agent_id=approver_agent.id,
                    comment=comment,
                )
            elif status == ApprovalStatus.REJECTED:
                approval = svc.reject(
                    decision_id=decision.id,
                    approver_agent_id=approver_agent.id,
                    comment=comment,
                )
            else:
                approval = svc.needs_changes(
                    decision_id=decision.id,
                    approver_agent_id=approver_agent.id,
                    comment=comment,
                )
            session.refresh(decision)
            return ApproveDecisionOutput(
                decision_id=decision.display_id,
                decision_status=decision.status.value,
                approval_status=approval.status.value,
            )

    # ------------------------------------------------------------------
    # get_decision_context
    # ------------------------------------------------------------------
    @server.tool(name="get_decision_context")
    def get_decision_context(decision_id: str) -> GetDecisionContextOutput:
        """Return the full context (decision + git + reviews + policies + events)."""
        with ctx.session() as session:
            decision = resolve_decision(session, display_id=decision_id)
            git_changes = sorted(decision.git_changes, key=lambda g: g.created_at)
            latest_git = git_changes[-1] if git_changes else None
            reviews = sorted(decision.reviews, key=lambda r: r.created_at)
            policy_results = sorted(decision.policy_results, key=lambda r: r.created_at)
            disagreements = sorted(decision.disagreements, key=lambda d: d.created_at)
            approvals = sorted(decision.approvals, key=lambda a: a.created_at)
            events = TimelineService(session).for_decision(decision.id)

            return GetDecisionContextOutput(
                decision={
                    "id": decision.display_id,
                    "title": decision.title,
                    "status": decision.status.value,
                    "risk_level": decision.risk_level.value,
                    "summary": decision.summary,
                    "rationale": decision.rationale,
                    "human_approval_required": decision.human_approval_required,
                },
                git_change=(
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
                reviews=[
                    {
                        "id": r.display_id,
                        "status": r.status.value,
                        "summary": r.summary,
                        "findings_count": len(r.findings),
                    }
                    for r in reviews
                ],
                policy_results=[
                    {
                        "policy_id": str(p.policy_id),
                        "status": p.status.value,
                        "message": p.message,
                    }
                    for p in policy_results
                ],
                disagreements=[
                    {
                        "id": str(d.id),
                        "topic": d.topic,
                        "requires_human_decision": d.requires_human_decision,
                        "resolution": d.resolution,
                    }
                    for d in disagreements
                ],
                approvals=[
                    {
                        "id": str(a.id),
                        "status": a.status.value,
                        "comment": a.comment,
                    }
                    for a in approvals
                ],
                events=[
                    {
                        "type": e.event_type,
                        "entity_type": e.entity_type,
                        "created_at": e.created_at.isoformat(),
                        "payload": dict(e.payload_json) if e.payload_json else {},
                    }
                    for e in events
                ],
            )

    # ------------------------------------------------------------------
    # list_open_reviews
    # ------------------------------------------------------------------
    @server.tool(name="list_open_reviews")
    def list_open_reviews(project_path: str) -> ListOpenReviewsOutput:
        """List reviews on decisions still in REVIEW_REQUIRED state."""
        with ctx.session() as session:
            project = resolve_project(session, project_path)
            reviews = ReviewService(session).list_open(project_id=project.id)
            from govforge.core.models import Agent

            agent_ids = {r.reviewer_agent_id for r in reviews}
            agent_names = {
                a.id: a.name for a in session.query(Agent).filter(Agent.id.in_(agent_ids)).all()
            }
            return ListOpenReviewsOutput(
                reviews=[
                    OpenReviewEntry(
                        review_id=r.display_id,
                        decision_id=r.decision.display_id,
                        reviewer_agent=agent_names.get(r.reviewer_agent_id, ""),
                        status=r.status.value,
                    )
                    for r in reviews
                ]
            )

    # ------------------------------------------------------------------
    # list_pending_approvals
    # ------------------------------------------------------------------
    @server.tool(name="list_pending_approvals")
    def list_pending_approvals(project_path: str) -> ListPendingApprovalsOutput:
        """List decisions awaiting human approval."""
        with ctx.session() as session:
            project = resolve_project(session, project_path)
            decisions = ApprovalService(session).list_pending(project_id=project.id)
            return ListPendingApprovalsOutput(
                decisions=[
                    PendingApprovalEntry(
                        decision_id=d.display_id,
                        title=d.title,
                        risk_level=d.risk_level.value,
                        status=d.status.value,
                    )
                    for d in decisions
                ]
            )


__all__ = ["register_tools"]
