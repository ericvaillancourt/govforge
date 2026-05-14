import * as vscode from "vscode";
import { ApiError, GovForgeClient, type TokenScope } from "./api/client";

/**
 * In-memory cache of the current token's scopes, refreshed from /me on
 * sign-in / backend switch. Three states:
 *
 *   - `undefined` (never resolved yet) → callers should treat as "unknown,
 *     show everything" (fallback). Same when the backend doesn't expose
 *     /me (404) or when the request errored.
 *   - `[]` empty array → token has zero write scopes; UI should fall back
 *     to the read-only welcome view.
 *   - `[...scopes]` → use intersection logic with the chosen focus mode.
 */
export class ScopeState implements vscode.Disposable {
    private _scopes: TokenScope[] | undefined = undefined;
    private readonly _emitter = new vscode.EventEmitter<void>();
    readonly onDidChange = this._emitter.event;

    constructor(
        private readonly client: GovForgeClient,
        private readonly output: vscode.OutputChannel,
    ) {}

    dispose(): void {
        this._emitter.dispose();
    }

    /** Current scopes, or `undefined` if we haven't resolved them. */
    scopes(): TokenScope[] | undefined {
        return this._scopes;
    }

    /** Force scopes to `undefined` (signed out / pre-resolution). */
    clear(): void {
        if (this._scopes !== undefined) {
            this._scopes = undefined;
            this._emitter.fire();
        }
    }

    /** Re-fetch from /me. Silently degrades to `undefined` on 404 (old
     *  backend) or network error — callers must accept that "unknown means
     *  show everything". */
    async refresh(): Promise<void> {
        let next: TokenScope[] | undefined;
        try {
            const me = await this.client.me();
            next = me.token?.scopes ?? [];
            this.output.appendLine(
                `[scope-state] /me → ${next.length} scopes: ${next.join(", ") || "(none)"}`,
            );
        } catch (err) {
            if (err instanceof ApiError && err.status === 404) {
                this.output.appendLine(
                    "[scope-state] /me returned 404 — backend predates role-aware UI, falling back to show-all",
                );
            } else if (err instanceof ApiError && err.status === 401) {
                this.output.appendLine(
                    "[scope-state] /me returned 401 — token rejected",
                );
            } else {
                this.output.appendLine(
                    `[scope-state] /me failed: ${err instanceof Error ? err.message : String(err)}`,
                );
            }
            next = undefined;
        }
        const changed =
            this._scopes === undefined
                ? next !== undefined
                : next === undefined ||
                  next.length !== this._scopes.length ||
                  next.some((s, i) => s !== this._scopes![i]);
        this._scopes = next;
        if (changed) this._emitter.fire();
    }
}
