import * as vscode from "vscode";
import { getAgentName } from "../agent";
import { GovForgeClient } from "../api/client";
import type { TaskOut } from "../api/types";
import type { FormPanelHost } from "../forms/form-panel";
import type { ProjectSelection } from "../project-selection";
import { DecisionItem } from "../views/decisions-tree";
import { TaskItem } from "../views/tasks-tree";
import { resolveActiveProject } from "../workspace";

const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;

export function registerDecisionCommands(
    context: vscode.ExtensionContext,
    client: GovForgeClient,
    selection: ProjectSelection,
    onChanged: () => void | Promise<void>,
    formPanels: FormPanelHost,
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "govforge.recordDecision",
            (taskItem?: TaskItem) => recordDecision(client, selection, formPanels, taskItem),
        ),
        vscode.commands.registerCommand(
            "govforge.attachGitDiff",
            (decisionItem?: DecisionItem) => attachGitDiff(client, selection, onChanged, decisionItem),
        ),
        vscode.commands.registerCommand(
            "govforge.runPolicyChecks",
            (decisionItem?: DecisionItem) => runPolicyChecks(client, selection, onChanged, decisionItem),
        ),
    );
}

async function pickTask(
    client: GovForgeClient,
    selection: ProjectSelection,
): Promise<TaskOut | undefined> {
    const project = await resolveActiveProject(client, selection);
    if (!project) {
        vscode.window.showWarningMessage(
            "GovForge: pick a project first.",
        );
        return undefined;
    }
    const tasks = await client.listTasks(project.root_path);
    if (tasks.length === 0) {
        vscode.window.showWarningMessage(
            "GovForge: no tasks on this project. Create one first via `GovForge: Create Task`.",
        );
        return undefined;
    }
    const pick = await vscode.window.showQuickPick(
        tasks.map((t) => ({
            label: `${t.display_id} ${t.title}`,
            description: `${t.status} · ${t.risk_level}`,
            task: t,
        })),
        { title: "GovForge: select task", ignoreFocusOut: true },
    );
    return pick?.task;
}

async function pickDecisionDisplayId(
    client: GovForgeClient,
    selection: ProjectSelection,
): Promise<string | undefined> {
    const project = await resolveActiveProject(client, selection);
    if (!project) {
        vscode.window.showWarningMessage("GovForge: pick a project first.");
        return undefined;
    }
    const decisions = await client.listDecisions(project.root_path);
    if (decisions.length === 0) {
        vscode.window.showWarningMessage("GovForge: no decisions on this project.");
        return undefined;
    }
    const pick = await vscode.window.showQuickPick(
        decisions.map((d) => ({
            label: `${d.display_id} ${d.title}`,
            description: `${d.status} · ${d.risk_level}`,
            id: d.display_id,
        })),
        { title: "GovForge: select decision", ignoreFocusOut: true },
    );
    return pick?.id;
}

async function recordDecision(
    client: GovForgeClient,
    selection: ProjectSelection,
    formPanels: FormPanelHost,
    taskItem: TaskItem | undefined,
): Promise<void> {
    const task = taskItem?.task ?? (await pickTask(client, selection));
    if (!task) return;
    await formPanels.openForm({
        form: "recordDecision",
        taskId: task.display_id,
        taskTitle: task.title,
        defaultAuthor: getAgentName(),
        riskLevels: [...RISK_LEVELS],
    });
}

async function attachGitDiff(
    client: GovForgeClient,
    selection: ProjectSelection,
    onChanged: () => void | Promise<void>,
    decisionItem: DecisionItem | undefined,
): Promise<void> {
    const decisionId =
        decisionItem?.decision.display_id ??
        (await pickDecisionDisplayId(client, selection));
    if (!decisionId) return;

    // Default repo_path is the active project's root_path. When the user
    // works in multi-root, fall back to the first workspace folder.
    const project = await resolveActiveProject(client, selection);
    const folders = vscode.workspace.workspaceFolders ?? [];
    const defaultPath = project?.root_path ?? folders[0]?.uri.fsPath ?? "";

    const repoPath = await vscode.window.showInputBox({
        title: `GovForge: attach git diff to ${decisionId}`,
        prompt: "Repository path (absolute)",
        value: defaultPath,
        ignoreFocusOut: true,
        validateInput: (v) => (v.trim().length === 0 ? "Required" : null),
    });
    if (!repoPath) return;

    const commitHash = await vscode.window.showInputBox({
        title: "Commit hash (defaults to HEAD)",
        value: "HEAD",
        ignoreFocusOut: true,
    });
    if (commitHash === undefined) return;

    try {
        await client.attachGitDiff(decisionId, {
            repo_path: repoPath.trim(),
            commit_hash: commitHash.trim() || "HEAD",
            actor_agent: getAgentName(),
        });
        vscode.window.showInformationMessage(
            `GovForge: git diff attached to ${decisionId}.`,
        );
        await onChanged();
    } catch (err) {
        vscode.window.showErrorMessage(
            `GovForge: attach git failed — ${err instanceof Error ? err.message : String(err)}`,
        );
    }
}

async function runPolicyChecks(
    client: GovForgeClient,
    selection: ProjectSelection,
    onChanged: () => void | Promise<void>,
    decisionItem: DecisionItem | undefined,
): Promise<void> {
    const decisionId =
        decisionItem?.decision.display_id ??
        (await pickDecisionDisplayId(client, selection));
    if (!decisionId) return;

    try {
        const out = (await client.runPolicyCheck({
            decision_id: decisionId,
            actor_agent: getAgentName(),
        })) as { decision_status?: string; results?: Array<{ policy: string; status: string; message?: string }> };

        const blocked = out.results?.filter((r) => r.status === "blocked").length ?? 0;
        const total = out.results?.length ?? 0;
        const status = out.decision_status ?? "?";
        const msg =
            blocked > 0
                ? `GovForge: ${decisionId} → ${status}. ${blocked}/${total} polic${blocked === 1 ? "y" : "ies"} blocked.`
                : `GovForge: ${decisionId} → ${status}. All ${total} polic${total === 1 ? "y" : "ies"} passed.`;
        if (blocked > 0) {
            vscode.window.showWarningMessage(msg);
        } else {
            vscode.window.showInformationMessage(msg);
        }
        await onChanged();
    } catch (err) {
        vscode.window.showErrorMessage(
            `GovForge: policy check failed — ${err instanceof Error ? err.message : String(err)}`,
        );
    }
}
