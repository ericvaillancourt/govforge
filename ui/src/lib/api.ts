/**
 * Typed wrapper around the GovForge HTTP API.
 *
 * Every function maps to one route exposed by `backend/src/govforge/api`.
 * Server-side errors come back as APIError so callers can distinguish 404
 * (`not found`) from other failures.
 */

import type { MeOut } from "./scopes";
import { getToken } from "./token";

export const API_BASE =
  process.env.NEXT_PUBLIC_GOVFORGE_API ?? "http://127.0.0.1:8787";

export class APIError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(`api ${status}: ${detail}`);
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const r = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  if (!r.ok) {
    let detail = await r.text();
    try {
      const parsed = JSON.parse(detail) as { detail?: unknown };
      if (typeof parsed.detail === "string") detail = parsed.detail;
    } catch {
      // keep raw body
    }
    throw new APIError(r.status, detail);
  }
  if (r.status === 204) return undefined as unknown as T;
  return (await r.json()) as T;
}

// --------------------------------------------------------------------------
// Domain types — mirror backend Pydantic schemas in
// backend/src/govforge/api/schemas.py
// --------------------------------------------------------------------------

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type DecisionStatus =
  | "draft"
  | "review_required"
  | "changes_requested"
  | "approved"
  | "rejected";
export type TaskStatus =
  | "open"
  | "in_progress"
  | "review_required"
  | "approved"
  | "rejected"
  | "closed";
export type ReviewStatus =
  | "approved"
  | "changes_requested"
  | "commented"
  | "rejected";
export type FindingSeverity =
  | "info"
  | "low"
  | "medium"
  | "high"
  | "critical";
export type FindingCategory =
  | "security"
  | "performance"
  | "architecture"
  | "bug"
  | "maintainability"
  | "tests";
export type PolicyResultStatus = "passed" | "warning" | "blocked";

export interface Project {
  id: string;
  name: string;
  root_path: string;
  default_branch: string;
  created_at: string;
}

export interface Task {
  id: string;
  display_id: string;
  project_id: string;
  title: string;
  description: string | null;
  risk_level: RiskLevel;
  status: TaskStatus;
  created_at: string;
}

export interface Decision {
  id: string;
  display_id: string;
  project_id: string;
  task_id: string | null;
  title: string;
  summary: string | null;
  rationale: string | null;
  status: DecisionStatus;
  risk_level: RiskLevel;
  human_approval_required: boolean;
  created_at: string;
}

export interface GitChange {
  id: string;
  decision_id: string;
  repo_path: string;
  branch_name: string | null;
  commit_hash: string;
  parent_commit_hash: string | null;
  diff_hash: string;
  files_changed_json: string[];
  insertions: number;
  deletions: number;
}

export interface Finding {
  id: string;
  severity: FindingSeverity;
  category: FindingCategory;
  file_path: string | null;
  line_start: number | null;
  line_end: number | null;
  message: string;
  recommendation: string | null;
}

export interface Review {
  id: string;
  display_id: string;
  decision_id: string;
  reviewer_agent_id: string;
  status: ReviewStatus;
  summary: string | null;
  created_at: string;
  findings: Finding[];
}

export interface Policy {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  severity: FindingSeverity;
  config_json: Record<string, unknown> | null;
}

export interface PolicyResult {
  id: string;
  decision_id: string;
  policy_id: string;
  status: PolicyResultStatus;
  message: string | null;
  evidence_json: Record<string, unknown> | null;
  created_at: string;
}

export interface Approval {
  id: string;
  decision_id: string;
  status: "approved" | "rejected" | "needs_changes";
  comment: string | null;
  created_at: string;
}

export interface Event {
  id: string;
  project_id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  actor_agent_id: string | null;
  payload_json: Record<string, unknown> | null;
  created_at: string;
}

export interface Health {
  status: string;
  version: string;
}

// --------------------------------------------------------------------------
// API surface — one function per backend route
// --------------------------------------------------------------------------

export const api = {
  health: () => request<Health>("/health"),

  me: () => request<MeOut>("/me"),

  projects: {
    list: () => request<Project[]>("/projects"),
  },

  tasks: {
    list: (projectPath: string, status?: TaskStatus) => {
      const q = new URLSearchParams({ project_path: projectPath });
      if (status) q.set("status", status);
      return request<Task[]>(`/tasks?${q.toString()}`);
    },
    get: (id: string) => request<Task>(`/tasks/${id}`),
  },

  decisions: {
    list: (projectPath: string, status?: DecisionStatus) => {
      const q = new URLSearchParams({ project_path: projectPath });
      if (status) q.set("status", status);
      return request<Decision[]>(`/decisions?${q.toString()}`);
    },
    get: (id: string) => request<Decision>(`/decisions/${id}`),
    timeline: (id: string) => request<Event[]>(`/decisions/${id}/timeline`),
    approve: (id: string, body: { approver: string; comment?: string }) =>
      request<Approval>(`/decisions/${id}/approve`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    reject: (id: string, body: { approver: string; comment?: string }) =>
      request<Approval>(`/decisions/${id}/reject`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },

  reviews: {
    list: (projectPath: string, openOnly = false) => {
      const q = new URLSearchParams({ project_path: projectPath });
      if (openOnly) q.set("open_only", "true");
      return request<Review[]>(`/reviews?${q.toString()}`);
    },
    get: (id: string) => request<Review>(`/reviews/${id}`),
  },

  policies: {
    list: () => request<Policy[]>("/policies"),
  },
};
