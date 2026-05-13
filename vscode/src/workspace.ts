import * as vscode from "vscode";
import type { GovForgeClient } from "./api/client";
import type { ProjectOut } from "./api/types";
import type { ProjectSelection } from "./project-selection";

/**
 * Resolve the GovForge Project that should drive the sidebar trees.
 *
 * Order of precedence:
 *
 *   1. Explicit pick from `ProjectSelection` (the user clicked
 *      "GovForge: Switch Project" and chose one).
 *   2. Workspace-folder match — any `Project.root_path` that exactly
 *      equals one of `vscode.workspace.workspaceFolders[].uri.fsPath`.
 *
 * Returns `undefined` when neither path resolves — callers can then surface
 * a hint to the user (e.g., the trees stay empty and the status bar shows
 * "no project").
 *
 * For multi-root workspaces we return the FIRST folder match. The explicit
 * picker is the recommended workflow for multi-project setups.
 */
export async function resolveActiveProject(
    client: GovForgeClient,
    selection: ProjectSelection,
): Promise<ProjectOut | undefined> {
    let projects: ProjectOut[];
    try {
        projects = await client.listProjects();
    } catch {
        return undefined;
    }
    if (projects.length === 0) {
        return undefined;
    }

    // 1. Explicit pick wins.
    const selectedId = selection.getId();
    if (selectedId) {
        const match = projects.find((p) => p.id === selectedId);
        if (match) {
            return match;
        }
        // Stale selection — fall through to auto-detect rather than block.
    }

    // 2. Auto-detect from workspace folders.
    const folders = vscode.workspace.workspaceFolders ?? [];
    if (folders.length === 0) {
        return undefined;
    }
    const folderPaths = new Set(folders.map((f) => f.uri.fsPath));
    return projects.find((p) => folderPaths.has(p.root_path));
}
