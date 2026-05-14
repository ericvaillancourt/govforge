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

/**
 * Disk-backed fallback used only when SecretStorage drops writes (typically
 * Linux without a working keyring daemon). It targets the **same chmod 0600
 * file the `gf` CLI uses** (`~/.config/govforge/auth.toml`), so we inherit
 * its security model instead of inventing one: only the user can read it,
 * it's outside the workspace, it's not synced. This is the same model gh,
 * aws, gcloud, kubectl, and terraform use.
 *
 * Trade-off: the file holds a single token (no per-backend keying), so if
 * the keyring is broken the user picks one backend at a time — same as the
 * CLI. Keyring users keep per-backend storage.
 */
export interface TokenFallback {
    /** Return the token currently in the on-disk auth file, if any. */
    read(): Promise<string | undefined>;
    /** Write `value` (or delete the file if value is undefined). */
    write(value: string | undefined): Promise<void>;
    /** Surface a one-time warning to the user. */
    warn(msg: string): void;
}

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
    private fallback?: TokenFallback;
    private warnedFallback = false;

    constructor(private readonly secrets: vscode.SecretStorage) {}

    /** Wire an unencrypted fallback for setups where SecretStorage drops
     *  writes (typically Linux without a working keyring). The client
     *  prefers SecretStorage but falls through to this on read miss and
     *  writes here when the SecretStorage round-trip fails. */
    setFallback(fb: TokenFallback): void {
        this.fallback = fb;
    }

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
        // Highest priority: env var. Matches the CLI's resolution order.
        const envToken = (process.env.GOVFORGE_API_TOKEN ?? "").trim();
        if (envToken) return envToken;

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
        // Keyring missed → fall through to the CLI's auth.toml.
        if (!token && this.fallback) {
            token = await this.fallback.read();
        }
        return token;
    }

    async setToken(token: string): Promise<void> {
        const key = this.currentKey();
        await this.secrets.store(key, token);
        // Probe: if SecretStorage silently dropped the write, persist
        // into the chmod 0600 CLI auth file instead. Same security model
        // as the `gf` CLI.
        const echo = await this.secrets.get(key);
        if (echo !== token && this.fallback) {
            await this.fallback.write(token);
            if (!this.warnedFallback) {
                this.warnedFallback = true;
                this.fallback.warn(
                    "GovForge: OS keyring unavailable — token saved to ~/.config/govforge/auth.toml (chmod 0600, shared with `gf` CLI). Install/unlock gnome-keyring for encrypted storage.",
                );
            }
        } else if (echo === token && this.fallback) {
            // Keyring worked; keep auth.toml in sync so the CLI sees the
            // same token. This means signing in via VS Code also signs in
            // the CLI — matches user expectation.
            await this.fallback.write(token);
        }
    }

    async clearToken(): Promise<void> {
        const key = this.currentKey();
        await this.secrets.delete(key);
        if (this.fallback) {
            await this.fallback.write(undefined);
        }
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

    /** Introspect the current token. Returns the principal + scopes. Older
     *  backends without /me return 404; callers should treat that as "scopes
     *  unknown → show all commands". */
    me(): Promise<MeOut> {
        return this.fetch<MeOut>("/me");
    }
}

// ---------------------------------------------------------------------------
// Read-side output types
// ---------------------------------------------------------------------------

export const TOKEN_SCOPES = [
    "projects:read",
    "projects:write",
    "tasks:read",
    "tasks:write",
    "decisions:read",
    "decisions:write",
    "reviews:read",
    "reviews:write",
    "policies:read",
    "policies:write",
    "approvals:read",
    "approvals:write",
    "events:read",
    "tokens:read",
    "tokens:write",
    "admin",
] as const;

export type TokenScope = (typeof TOKEN_SCOPES)[number];

export interface MeOut {
    user: {
        id: string;
        email: string;
        display_name: string | null;
    };
    token: {
        id: string;
        label: string;
        scopes: TokenScope[];
    } | null;
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
