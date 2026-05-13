import * as vscode from "vscode";
import type {
    DecisionOut,
    EventOut,
    HealthOut,
    ProjectOut,
    ReviewOut,
    TaskOut,
} from "./types";

const TOKEN_SECRET_KEY = "govforge.apiToken";

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
 * Thin HTTP client over the GovForge backend. Reads the bearer token from
 * VS Code SecretStorage on every call so a sign-out / sign-in flow takes
 * effect immediately without restarting the extension.
 */
export class GovForgeClient {
    constructor(private readonly secrets: vscode.SecretStorage) {}

    private baseUrl(): string {
        const cfg = vscode.workspace.getConfiguration("govforge");
        return cfg
            .get<string>("apiUrl", "http://127.0.0.1:8787")
            .replace(/\/$/, "");
    }

    async getToken(): Promise<string | undefined> {
        return this.secrets.get(TOKEN_SECRET_KEY);
    }

    async setToken(token: string): Promise<void> {
        await this.secrets.store(TOKEN_SECRET_KEY, token);
    }

    async clearToken(): Promise<void> {
        await this.secrets.delete(TOKEN_SECRET_KEY);
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

    listReviews(projectPath: string, openOnly = false): Promise<ReviewOut[]> {
        const q = new URLSearchParams({ project_path: projectPath });
        if (openOnly) q.set("open_only", "true");
        return this.fetch<ReviewOut[]>(`/reviews?${q}`);
    }
}
