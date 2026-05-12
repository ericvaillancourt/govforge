// Mirrors backend Pydantic schemas. Regenerate from the live API with:
//   npm run gen-types
// (requires a backend reachable at govforge.apiUrl + /openapi.json).
// The hand-written shapes below cover the v0.1 read surface and stay
// close to backend/src/govforge/api/schemas.py.

export interface ProjectOut {
    id: string;
    name: string;
    root_path: string;
    created_at: string;
}

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type TaskStatus =
    | "open"
    | "in_progress"
    | "review_required"
    | "approved"
    | "rejected"
    | "closed";

export interface TaskOut {
    id: string;
    display_id: string;
    project_id: string;
    title: string;
    description: string | null;
    risk_level: RiskLevel;
    status: TaskStatus;
    created_at: string;
    updated_at: string;
}

export type DecisionStatus =
    | "draft"
    | "review_required"
    | "changes_requested"
    | "approved"
    | "rejected";

export interface DecisionOut {
    id: string;
    display_id: string;
    project_id: string;
    task_id: string | null;
    author_agent_id: string;
    title: string;
    summary: string | null;
    rationale: string | null;
    status: DecisionStatus;
    risk_level: RiskLevel;
    human_approval_required: boolean;
    created_at: string;
    updated_at: string;
}

export type ReviewStatus =
    | "approved"
    | "changes_requested"
    | "commented"
    | "rejected";

export type FindingSeverity = "info" | "low" | "medium" | "high" | "critical";

export type FindingCategory =
    | "security"
    | "performance"
    | "architecture"
    | "bug"
    | "maintainability"
    | "tests"
    | "docs"
    | "accessibility";

export interface FindingOut {
    id: string;
    severity: FindingSeverity;
    category: FindingCategory;
    file_path: string | null;
    line_start: number | null;
    line_end: number | null;
    message: string;
    recommendation: string | null;
}

export interface ReviewOut {
    id: string;
    display_id: string;
    decision_id: string;
    reviewer_agent_id: string;
    status: ReviewStatus;
    summary: string | null;
    created_at: string;
    findings: FindingOut[];
}

export interface EventOut {
    id: string;
    project_id: string;
    entity_type: string;
    entity_id: string;
    event_type: string;
    actor_agent_id: string | null;
    payload_json: Record<string, unknown> | null;
    created_at: string;
}

export interface HealthOut {
    status: string;
    version: string;
}
