"use client";

// Browser-side client for the auth/tokens API at api.govforge.dev.
// All requests include credentials so the session cookie travels.

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.govforge.dev";

export interface SessionUser {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  accounts: string[];
}

export interface SessionInfo {
  user: SessionUser;
  expires_at: string;
  last_seen_at: string;
}

export interface ApiTokenSummary {
  id: string;
  label: string;
  agent_type: string;
  prefix: string;
  scopes_csv: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

export interface CreateTokenIn {
  label: string;
  agent_type: string;
  scopes: string[];
  expires_in_days?: number;
}

export interface CreateTokenOut {
  token: ApiTokenSummary;
  secret: string;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    ...init,
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body?.detail) detail = body.detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const authApi = {
  getSession: () => call<SessionInfo>("/auth/session"),
  logout: () => call<void>("/auth/logout", { method: "POST" }),
  startGithub: () => {
    window.location.href = `${API_BASE}/auth/github/start`;
  },
};

export const tokensApi = {
  list: () => call<ApiTokenSummary[]>("/tokens"),
  create: (body: CreateTokenIn) =>
    call<CreateTokenOut>("/tokens", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  revoke: (id: string) =>
    call<void>(`/tokens/${id}`, { method: "DELETE" }),
};

export const ALL_SCOPES = [
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
  "events:read",
  "tokens:read",
  "tokens:write",
  "admin",
] as const;

export const AGENT_TYPES = [
  "human",
  "claude",
  "codex",
  "cursor",
  "cline",
  "aider",
  "other",
] as const;
