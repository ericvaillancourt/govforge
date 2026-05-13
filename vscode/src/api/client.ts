import * as vscode from "vscode";
import type {
    DecisionOut,
    EventOut,
    HealthOut,
    ProjectOut,
    ReviewOut,
    TaskOut,
} from "./types";

// Legacy key (pre-per-backend-storage). Read once for migration, then deleted.
const LEGACY_TOKEN_KEY = "govforge.apiToken";

export class ApiError extends Error {
    constructor(
        public readonly status: number,
        message: string,
        public readonly detail?: unknown,
    ) {
        super(message);
        this.name = "ApiError";
    }
}

/**
 * Thin HTTP client over the GovForge backend.
 *
 * Tokens are stored **per backend URL** in VS Code SecretStorage, so
 * switching `govforge.apiUrl` between local and hosted picks up the
 * right token automatically instead of forcing a re-paste. Each token
 * is keyed `govforge.apiToken:${normalized-base-url}`. On first read
 * we migrate any pre-existing global token (`govforge.apiToken`) over
 * to the current URL's key, then delete the legacy entry.
 */
export class GovForgeClient {
    constructor(private readonly secrets: vscode.SecretStorage) {}

    private baseUrl(): string {
        const cfg = vscode.workspace.getConfiguration("govforge");
        return cfg
            .get<string>("apiUrl", "http://127.0.0.1:8787")
            .replace(/\/$/, "");
    }

    private currentKey(): string {
        return `govforge.apiToken:${this.baseUrl()}`;
    }

    async getToken(): Promise<string | undefined> {
        const key = this.currentKey();
        let token = await this.secrets.get(key);
        if (!token) {
            // One-time migration from the pre-Phase-6 global key.
            const legacy = await this.secrets.get(LEGACY_TOKEN_KEY);
            if (legacy) {
                await this.secrets.store(key, legacy);
                await this.secrets.delete(LEGACY_TOKEN_KEY);
                token = legacy;
            }
        }
        return token;
    }

    async setToken(token: string): Promise<void> {
        await this.secrets.store(this.currentKey(), token);
    }

    async clearToken(): Promise<void> {
        await this.secrets.delete(this.currentKey());
    }

    /** True iff a token is stored for the current backend. Cheap-ish — used
     *  by activation + backend-switch flows to decide whether to prompt
     *  for sign-in. */
    async hasToken(): Promise<boolean> {
        return Boolean(await this.getToken());
    }

    private async fetch<T>(path: string, init: RequestInit = {}): Promise<T> {
        const token = await this.getToken();
        const headers = new Headers(init.headers);
        headers.set("accept", "application/json");
        if (init.body && !headers.has("content-type")) {
            headers.set("content-type", "application/json");
        }
        if (token) {
            headers.set("authorization", `Bearer ${token}`);
        }
        const res = await fetch(`${this.baseUrl()}${path}`, { ...init, headers });
        if (!res.ok) {
            let detail: unknown = undefined;
            try {
                detail = await res.json();
            } catch {
                /* not json */
            }
            throw new ApiError(res.status, `${res.status} ${res.statusText}`, detail);
        }
        if (res.status === 204) {
            return undefined as T;
        }
        return (await res.json()) as T;
    }

    health(): Promise<HealthOut> {
        return this.fetch<HealthOut>("/health");
    }

    listProjects(): Promise<ProjectOut[]> {
        return this.fetch<ProjectOut[]>("/projects");
    }

    listTasks(projectPath: string): Promise<TaskOut[]> {
        const q = new URLSearchParams({ project_path: projectPath });
        return this.fetch<TaskOut[]>(`/tasks?${q}`);
    }

    createTask(input: CreateTaskInput): Promise<TaskOut> {
        return this.fetch<TaskOut>("/tasks", {
            method: "POST",
            body: JSON.stringify(input),
        });
    }

    listDecisions(projectPath: string): Promise<DecisionOut[]> {
        const q = new URLSearchParams({ project_path: projectPath });
        return this.fetch<DecisionOut[]>(`/decisions?${q}`);
    }

    getDecision(displayId: string): Promise<DecisionOut> {
        return this.fetch<DecisionOut>(`/decisions/${displayId}`);
    }

    getDecisionTimeline(displayId: string): Promise<EventOut[]> {
        return this.fetch<EventOut[]>(`/decisions/${displayId}/timeline`);
    }

    createDecision(input: CreateDecisionInput): Promise<DecisionOut> {
        return this.fetch<DecisionOut>("/decisions", {
            method: "POST",
            body: JSON.stringify(input),
        });
    }

    attachGitDiff(
        decisionDisplayId: string,
        input: AttachGitInput,
    ): Promise<unknown> {
        return this.fetch<unknown>(`/decisions/${decisionDisplayId}/attach-git`, {
            method: "POST",
            body: JSON.stringify(input),
        });
    }

    runPolicyCheck(input: PolicyCheckInput): Promise<unknown> {
        return this.fetch<unknown>("/policies/check", {
            method: "POST",
            body: JSON.stringify(input),
        });
    }

    listReviews(projectPath: string, openOnly = false): Promise<ReviewOut[]> {
        const q = new URLSearchParams({ project_path: projectPath });
        if (openOnly) q.set("open_only", "true");
        return this.fetch<ReviewOut[]>(`/reviews?${q}`);
    }

    requestReview(input: RequestReviewInput): Promise<unknown> {
        return this.fetch<unknown>("/reviews/request", {
            method: "POST",
            body: JSON.stringify(input),
        });
    }

    submitReview(input: SubmitReviewInput): Promise<ReviewOut> {
        return this.fetch<ReviewOut>("/reviews", {
            method: "POST",
            body: JSON.stringify(input),
        });
    }

    approveDecision(displayId: string, input: ApprovalInput): Promise<unknown> {
        return this.fetch<unknown>(`/decisions/${displayId}/approve`, {
            method: "POST",
            body: JSON.stringify(input),
        });
    }

    rejectDecision(displayId: string, input: ApprovalInput): Promise<unknown> {
        return this.fetch<unknown>(`/decisions/${displayId}/reject`, {
            method: "POST",
            body: JSON.stringify(input),
        });
    }

    recordDisagreement(input: DisagreementInput): Promise<unknown> {
        return this.fetch<unknown>("/disagreements", {
            method: "POST",
            body: JSON.stringify(input),
        });
    }
}

// ---------------------------------------------------------------------------
// Write-side input types — mirror backend Pydantic models.
// ---------------------------------------------------------------------------

export interface CreateTaskInput {
    project_path: string;
    title: string;
    description?: string;
    risk_level?: "low" | "medium" | "high" | "critical";
    actor_agent?: string;
}

export interface CreateDecisionInput {
    task_id: string;
    author_agent: string;
    title: string;
    summary?: string;
    rationale?: string;
    risk_level?: "low" | "medium" | "high" | "critical";
    human_approval_required?: boolean;
}

export interface AttachGitInput {
    repo_path: string;
    commit_hash?: string;
    actor_agent?: string;
}

export interface PolicyCheckInput {
    decision_id: string;
    config_path?: string;
    actor_agent?: string;
}

export interface RequestReviewInput {
    decision_id: string;
    reviewer_agent: string;
    focus?: string[];
    actor_agent?: string;
}

export type ReviewVerdict = "approved" | "changes_requested" | "commented" | "rejected";
export type Severity = "info" | "low" | "medium" | "high" | "critical";
export type FindingCat =
    | "security"
    | "performance"
    | "architecture"
    | "bug"
    | "maintainability"
    | "tests"
    | "docs"
    | "accessibility";

export interface FindingInput {
    severity: Severity;
    category: FindingCat;
    file_path?: string;
    line_start?: number;
    line_end?: number;
    message: string;
    recommendation?: string;
}

export interface SubmitReviewInput {
    decision_id: string;
    reviewer_agent: string;
    status: ReviewVerdict;
    summary?: string;
    findings: FindingInput[];
}

export interface ApprovalInput {
    approver: string;
    comment?: string;
}

export interface DisagreementInput {
    decision_id: string;
    topic: string;
    author_position?: string;
    reviewer_position?: string;
    risk_summary?: string;
    requires_human_decision?: boolean;
    actor_agent?: string;
}
