"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { api, APIError } from "./api";
import { hasScope as hasScopeFn, type MeOut, type TokenScope } from "./scopes";

/**
 * `useMe()` — fetches `/me` once, caches it across the tree, re-validates
 * on token swaps. Companion to the VS Code `ScopeState` class, same
 * unknown / null / array semantics:
 *
 *   - me === undefined          → /me not resolved yet (loading), or the
 *                                 backend doesn't expose /me (404). The
 *                                 returned `scopes` is undefined, which
 *                                 `hasScope()` reads as "show all" so an
 *                                 older self-hosted backend doesn't
 *                                 regress.
 *   - me.token === null         → cookie-authenticated session (cockpit
 *                                 doesn't use cookie auth today, so this
 *                                 branch is effectively unreachable for
 *                                 now but kept for correctness).
 *   - me.token.scopes === array → known, the source of truth.
 *
 * On 401 we treat scopes as `null` (signed out) — any `hasScope()` call
 * returns false, the gate is closed.
 */
export function useMe() {
  const queryClient = useQueryClient();

  // Invalidate the query whenever the token changes so the new bearer
  // is used immediately. The `TokenGate` component already dispatches
  // `govforge:token-changed` on save / sign-out.
  useEffect(() => {
    const onChange = () => {
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    };
    window.addEventListener("govforge:token-changed", onChange);
    return () => {
      window.removeEventListener("govforge:token-changed", onChange);
    };
  }, [queryClient]);

  const query = useQuery<MeOut, Error>({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await api.me();
      } catch (err) {
        // 404 → backend predates /me. Synthesize an "unknown scopes"
        // response so the cockpit falls back to show-everything,
        // matching the v0.3 VS Code semantics.
        if (err instanceof APIError && err.status === 404) {
          return {
            user: { id: "", email: "", display_name: null },
            token: null,
          };
        }
        throw err;
      }
    },
    staleTime: 60_000,
    retry: (failureCount, err) => {
      // Don't retry auth failures — they won't fix themselves.
      if (err instanceof APIError && (err.status === 401 || err.status === 403)) {
        return false;
      }
      return failureCount < 1;
    },
  });

  const isSignedOut =
    query.error instanceof APIError && query.error.status === 401;

  // Resolve the three-state scope shape used by `hasScope()`.
  let scopes: TokenScope[] | null | undefined;
  if (isSignedOut) {
    scopes = null;
  } else if (query.data?.token) {
    scopes = query.data.token.scopes;
  } else if (query.data && query.data.token === null) {
    // /me responded but no token → cookie session OR synthesized 404
    // fallback. Treat as unknown for now.
    scopes = undefined;
  } else {
    scopes = undefined;
  }

  return {
    me: query.data ?? null,
    scopes,
    isLoading: query.isLoading,
    isSignedOut,
    error: query.error,
    hasScope: (required: TokenScope) => hasScopeFn(scopes, required),
    isAdmin: scopes != null && scopes.includes("admin"),
  };
}
