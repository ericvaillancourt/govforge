"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { clearToken, getToken, setToken } from "@/lib/token";

/**
 * Tiny header widget. Two states:
 *   - no token in localStorage → input + Save button
 *   - token present → masked prefix + Sign out button
 *
 * On save we invalidate every React Query cache so the cockpit refetches
 * with the new Authorization header (otherwise prior 401 results stay).
 */
export function TokenGate() {
  const [token, setStateToken] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;

    // All setState calls live after an `await` boundary so the React 19
    // `react-hooks/set-state-in-effect` rule is satisfied.
    void (async () => {
      const existing = getToken();
      if (existing) {
        await Promise.resolve();
        if (cancelled) return;
        setStateToken(existing);
        setLoaded(true);
        return;
      }
      // Local-first auto-sign-in: ask the Next.js server for the CLI's
      // token (from ~/.config/govforge/auth.toml). If found, store it
      // silently — the operator doesn't need to paste anything.
      // Skipped if the user has explicitly signed out this tab
      // (sessionStorage flag) so sign-out actually sticks.
      const explicitlySignedOut =
        window.sessionStorage.getItem("govforge.signed_out") === "1";
      if (!explicitlySignedOut) {
        try {
          const r = await fetch("/api/local-auth", { cache: "no-store" });
          const data: { token: string | null } = r.ok
            ? await r.json()
            : { token: null };
          if (cancelled) return;
          if (data.token) {
            // setToken fires `govforge:token-changed`; the listener
            // below picks it up to update local state.
            setToken(data.token);
          }
        } catch {
          // Network error or non-JSON body — fall through to manual paste.
        }
      }
      if (cancelled) return;
      setLoaded(true);
    })();

    const onChange = () => setStateToken(getToken());
    window.addEventListener("govforge:token-changed", onChange);
    return () => {
      cancelled = true;
      window.removeEventListener("govforge:token-changed", onChange);
    };
  }, []);

  if (!loaded) return null;

  function save() {
    const v = draft.trim();
    if (!v) return;
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("govforge.signed_out");
    }
    setToken(v);
    setDraft("");
    queryClient.invalidateQueries();
  }

  function signOut() {
    clearToken();
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("govforge.signed_out", "1");
    }
    queryClient.invalidateQueries();
  }

  if (!token) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="flex items-center gap-1"
      >
        <input
          type="password"
          placeholder="gfp_… token"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-44 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1 text-xs"
        />
        <button
          type="submit"
          className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2 py-1 text-xs hover:bg-[hsl(var(--border))]"
        >
          Sign in
        </button>
      </form>
    );
  }

  // Show only the prefix so the operator can confirm which token is active.
  const prefix = token.slice(0, 12);

  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        title={`Active token: ${prefix}…`}
        className="text-[hsl(var(--muted-foreground))]"
      >
        <code className="font-mono">{prefix}…</code>
      </span>
      <button
        type="button"
        onClick={signOut}
        className="rounded-md border border-[hsl(var(--border))] px-2 py-1 hover:bg-[hsl(var(--muted))]"
      >
        Sign out
      </button>
    </div>
  );
}
