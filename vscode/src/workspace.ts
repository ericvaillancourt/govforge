import * as vscode from "vscode";
import type { GovForgeClient } from "./api/client";
import type { ProjectOut } from "./api/types";

/**
 * Resolve the GovForge Project that matches one of the open workspace folders.
 *
 * Strategy: list projects from the backend, then look for one whose
 * `root_path` exactly equals one of `vscode.workspace.workspaceFolders[].uri.fsPath`.
 *
 * Returns `undefined` if no folder matches — callers can then offer
 * "Register this workspace as a GovForge project".
 *
 * For multi-root workspaces we return the FIRST match. v0.1 is single-project;
 * multi-project workspaces are a later concern.
 */
export async function resolveActiveProject(
    client: GovForgeClient,
): Promise<ProjectOut | undefined> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    if (folders.length === 0) {
        return undefined;
    }
    let projects: ProjectOut[];
    try {
        projects = await client.listProjects();
    } catch {
        return undefined;
    }
    const folderPaths = new Set(folders.map((f) => f.uri.fsPath));
    return projects.find((p) => folderPaths.has(p.root_path));
}
