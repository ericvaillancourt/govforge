/**
 * Token scope model — mirrors `govforge.core.enums.TokenScope` in the
 * backend (single source of truth) and the same constant in
 * `vscode/src/api/client.ts`. If you add a scope on the server, add it
 * in all three places.
 *
 * The `MeOut` shape mirrors `MeOut` from
 * `backend/src/govforge/api/routers/me.py`.
 */

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

/**
 * Three states the UI must distinguish (same semantics as the VS Code
 * `ScopeState`):
 *
 *   - `undefined` — unknown (no `/me` response yet, or 404 from an old
 *     backend). Treated as "show everything" so we never regress UX on
 *     a stale backend.
 *   - `null`      — signed out (401 from `/me`).
 *   - `array`     — known. Source of truth; gate buttons strictly.
 */
export function hasScope(
  scopes: TokenScope[] | null | undefined,
  required: TokenScope,
): boolean {
  if (scopes === undefined) return true;
  if (scopes === null) return false;
  return scopes.includes("admin") || scopes.includes(required);
}
