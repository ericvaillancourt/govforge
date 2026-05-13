import * as vscode from "vscode";

const KEY = "govforge.selectedProjectId";

/**
 * Owns the user's explicit project pick. An explicit selection wins over
 * the workspace-folder auto-detection in `workspace.ts:resolveActiveProject`,
 * which makes the trees usable when the local workspace path doesn't match
 * any `Project.root_path` in the backend (very common with the hosted
 * backend, where paths were captured on whatever machine created the project).
 *
 * Per-workspace storage is preferred so different repos can stick to
 * different projects. Falls back to global state if no workspace is open.
 */
export class ProjectSelection {
    private readonly _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChange = this._onDidChange.event;

    constructor(private readonly context: vscode.ExtensionContext) {}

    getId(): string | undefined {
        return (
            this.context.workspaceState.get<string>(KEY) ??
            this.context.globalState.get<string>(KEY) ??
            undefined
        );
    }

    async setId(
        id: string | undefined,
        target: "global" | "workspace" = "workspace",
    ): Promise<void> {
        const store =
            target === "global"
                ? this.context.globalState
                : this.context.workspaceState;
        await store.update(KEY, id);
        this._onDidChange.fire();
    }

    /** Clear both per-workspace and global. */
    async clear(): Promise<void> {
        await this.context.workspaceState.update(KEY, undefined);
        await this.context.globalState.update(KEY, undefined);
        this._onDidChange.fire();
    }
}
