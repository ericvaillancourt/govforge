import * as vscode from "vscode";
import { getAgentName } from "../agent";
import { GovForgeClient } from "../api/client";
import type { FormPanelHost } from "../forms/form-panel";
import type { ProjectSelection } from "../project-selection";
import { resolveActiveProject } from "../workspace";

const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;

export function registerTaskCommands(
    context: vscode.ExtensionContext,
    client: GovForgeClient,
    selection: ProjectSelection,
    _onChanged: () => void | Promise<void>,
    formPanels: FormPanelHost,
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand("govforge.createTask", async () => {
            const project = await resolveActiveProject(client, selection);
            if (!project) {
                vscode.window.showWarningMessage(
                    "GovForge: pick a project first (status bar or `GovForge: Switch Project`).",
                );
                return;
            }
            await formPanels.openForm({
                form: "createTask",
                projectName: project.name,
                projectRootPath: project.root_path,
                defaultActor: getAgentName(),
                riskLevels: [...RISK_LEVELS],
            });
        }),
    );
}
