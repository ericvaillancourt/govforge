/**
 * Local auth token storage for the cockpit. Phase 3.0 Stage A requires
 * a Bearer token on every backend write; the cockpit asks the operator
 * to paste a `gfp_…` token (minted via `gf token create` or the hosted
 * /account page) and stores it in localStorage so subsequent fetches
 * carry the right header.
 *
 * Not great threat-model-wise (any script on the same origin can read
 * it) but acceptable for a single-tenant local cockpit on 127.0.0.1.
 * The hosted cockpit (app.govforge.dev, Phase 3) will switch to the
 * OAuth session cookie path which is HttpOnly.
 */

const KEY = "govforge.token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, token);
  // Tell other components (TokenGate, etc.) to re-read.
  window.dispatchEvent(new Event("govforge:token-changed"));
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("govforge:token-changed"));
}
