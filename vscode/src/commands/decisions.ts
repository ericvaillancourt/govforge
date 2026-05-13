import * as vscode from "vscode";
import { getAgentName } from "../agent";
import { GovForgeClient } from "../api/client";
import type { TaskOut } from "../api/types";
import type { ProjectSelection } from "../project-selection";
import { DecisionItem } from "../views/decisions-tree";
import { TaskItem } from "../views/tasks-tree";
import { resolveActiveProject } from "../workspace";

const RISK_LEVELS: vscode.QuickPickItem[] = [
    { label: "low" },
    { label: "medium", picked: true },
    { label: "high" },
    { label: "critical" },
];

type Risk = "low" | "medium" | "high" | "critical";

export function registerDecisionCommands(
    context: vscode.ExtensionContext,
    client: GovForgeClient,
    selection: ProjectSelection,
    onChanged: () => void | Promise<void>,
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "govforge.recordDecision",
            (taskItem?: TaskItem) => recordDecision(client, selection, onChanged, taskItem),
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
    onChanged: () => void | Promise<void>,
    taskItem: TaskItem | undefined,
): Promise<void> {
    const task = taskItem?.task ?? (await pickTask(client, selection));
    if (!task) return;

    const title = await vscode.window.showInputBox({
        title: `GovForge: record decision under ${task.display_id}`,
        prompt: "Decision title",
        placeHolder: "e.g. Use RS256 for JWT signing",
        ignoreFocusOut: true,
        validateInput: (v) => (v.trim().length === 0 ? "Title is required" : null),
    });
    if (!title) return;

    const summary = await vscode.window.showInputBox({
        title: "GovForge: decision summary (optional)",
        placeHolder: "One-line outcome",
        ignoreFocusOut: true,
    });

    const rationale = await vscode.window.showInputBox({
        title: "GovForge: decision rationale (optional)",
        placeHolder: "Why this choice over the alternatives?",
        ignoreFocusOut: true,
    });

    const risk = await vscode.window.showQuickPick(RISK_LEVELS, {
        title: "Risk level",
        ignoreFocusOut: true,
    });
    if (!risk) return;

    const humanApproval = await vscode.window.showQuickPick(
        [
            { label: "No — agent can self-approve", picked: true, value: false },
            { label: "Yes — human approval required", value: true },
        ],
        { title: "Human approval required?", ignoreFocusOut: true },
    );
    if (humanApproval === undefined) return;

    try {
        const decision = await client.createDecision({
            task_id: task.display_id,
            author_agent: getAgentName(),
            title: title.trim(),
            summary: summary?.trim() || undefined,
            rationale: rationale?.trim() || undefined,
            risk_level: risk.label as Risk,
            human_approval_required: humanApproval.value,
        });
        vscode.window.showInformationMessage(
            `GovForge: ${decision.display_id} recorded.`,
        );
        await onChanged();
    } catch (err) {
        vscode.window.showErrorMessage(
            `GovForge: record decision failed — ${err instanceof Error ? err.message : String(err)}`,
        );
    }
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
