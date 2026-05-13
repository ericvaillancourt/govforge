import * as vscode from "vscode";
import { getAgentName } from "../agent";
import { GovForgeClient } from "../api/client";
import type { ProjectSelection } from "../project-selection";
import { resolveActiveProject } from "../workspace";

const RISK_LEVELS: vscode.QuickPickItem[] = [
    { label: "low", description: "trivial change, no risk" },
    { label: "medium", description: "moderate impact, default", picked: true },
    { label: "high", description: "broad impact, needs review" },
    { label: "critical", description: "production-impacting, human gate" },
];

export function registerTaskCommands(
    context: vscode.ExtensionContext,
    client: GovForgeClient,
    selection: ProjectSelection,
    onChanged: () => void | Promise<void>,
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

            const title = await vscode.window.showInputBox({
                title: "GovForge: create task",
                prompt: `What's the task? (project: ${project.name})`,
                placeHolder: "e.g. Wire OAuth refresh-token rotation",
                ignoreFocusOut: true,
                validateInput: (v) =>
                    v.trim().length === 0 ? "Title is required" : null,
            });
            if (!title) return;

            const risk = await vscode.window.showQuickPick(RISK_LEVELS, {
                title: "Risk level",
                ignoreFocusOut: true,
            });
            if (!risk) return;

            const description = await vscode.window.showInputBox({
                title: "GovForge: create task — description (optional)",
                placeHolder: "Press Enter to skip",
                ignoreFocusOut: true,
            });

            try {
                const task = await client.createTask({
                    project_path: project.root_path,
                    title: title.trim(),
                    description: description?.trim() || undefined,
                    risk_level: risk.label as "low" | "medium" | "high" | "critical",
                    actor_agent: getAgentName(),
                });
                vscode.window.showInformationMessage(
                    `GovForge: ${task.display_id} created.`,
                );
                await onChanged();
            } catch (err) {
                vscode.window.showErrorMessage(
                    `GovForge: create task failed — ${err instanceof Error ? err.message : String(err)}`,
                );
            }
        }),
    );
}
