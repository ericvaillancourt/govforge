import * as vscode from "vscode";
import { GovForgeClient } from "../api/client";
import type { ProjectSelection } from "../project-selection";

interface ProjectQuickPick extends vscode.QuickPickItem {
    id?: string;
    clear?: true;
}

export function registerProjectCommands(
    context: vscode.ExtensionContext,
    client: GovForgeClient,
    selection: ProjectSelection,
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand("govforge.switchProject", async () => {
            let projects;
            try {
                projects = await client.listProjects();
            } catch (err) {
                vscode.window.showErrorMessage(
                    `GovForge: can't list projects — ${err instanceof Error ? err.message : String(err)}`,
                );
                return;
            }
            if (projects.length === 0) {
                vscode.window.showInformationMessage(
                    "GovForge: no projects on this backend. Create one with `gf init` in a repo, or via https://govforge.dev/.",
                );
                return;
            }

            const currentId = selection.getId();
            const items: ProjectQuickPick[] = projects.map((p) => ({
                label: `$(folder) ${p.name}`,
                description: p.root_path,
                detail: p.id === currentId ? "Currently active" : undefined,
                picked: p.id === currentId,
                id: p.id,
            }));
            if (currentId) {
                items.push({
                    label: "$(close) Clear selection — auto-detect from workspace folders",
                    clear: true,
                });
            }

            const pick = await vscode.window.showQuickPick(items, {
                title: "GovForge: select project",
                placeHolder: `${projects.length} project${projects.length === 1 ? "" : "s"} available on this backend`,
            });
            if (!pick) {
                return;
            }
            if (pick.clear) {
                await selection.clear();
                vscode.window.showInformationMessage(
                    "GovForge: project selection cleared. Auto-detecting from workspace folders.",
                );
                return;
            }
            if (pick.id) {
                // Workspace-scoped sticky pick. If there's no workspace, this
                // silently lands in globalState (see ProjectSelection).
                await selection.setId(pick.id, "workspace");
                vscode.window.showInformationMessage(
                    `GovForge: now showing project '${projects.find((p) => p.id === pick.id)?.name}'.`,
                );
            }
        }),
    );
}
