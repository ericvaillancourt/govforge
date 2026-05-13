import * as vscode from "vscode";
import { getAgentName } from "../agent";
import { ApiError, GovForgeClient } from "../api/client";
import type { ProjectSelection } from "../project-selection";
import { DecisionItem } from "../views/decisions-tree";
import { resolveActiveProject } from "../workspace";

type Verb = "approve" | "reject";

export function registerApprovalCommands(
    context: vscode.ExtensionContext,
    client: GovForgeClient,
    selection: ProjectSelection,
    onChanged: () => void | Promise<void>,
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "govforge.approve",
            (decisionItem?: DecisionItem) =>
                applyVerdict("approve", client, selection, onChanged, decisionItem),
        ),
        vscode.commands.registerCommand(
            "govforge.reject",
            (decisionItem?: DecisionItem) =>
                applyVerdict("reject", client, selection, onChanged, decisionItem),
        ),
    );
}

async function applyVerdict(
    verb: Verb,
    client: GovForgeClient,
    selection: ProjectSelection,
    onChanged: () => void | Promise<void>,
    decisionItem: DecisionItem | undefined,
): Promise<void> {
    let displayId = decisionItem?.decision.display_id;
    if (!displayId) {
        const project = await resolveActiveProject(client, selection);
        if (!project) {
            vscode.window.showWarningMessage("GovForge: pick a project first.");
            return;
        }
        const decisions = await client.listDecisions(project.root_path);
        if (decisions.length === 0) {
            vscode.window.showWarningMessage("GovForge: no decisions to act on.");
            return;
        }
        const pick = await vscode.window.showQuickPick(
            decisions.map((d) => ({
                label: `${d.display_id} ${d.title}`,
                description: `${d.status} · ${d.risk_level}`,
                id: d.display_id,
            })),
            {
                title: `GovForge: ${verb} which decision?`,
                ignoreFocusOut: true,
            },
        );
        if (!pick) return;
        displayId = pick.id;
    }

    const comment = await vscode.window.showInputBox({
        title: `GovForge: ${verb} ${displayId}`,
        prompt: `Comment (optional, but recommended for ${verb === "reject" ? "rejections" : "approvals on high-risk decisions"})`,
        ignoreFocusOut: true,
    });
    if (comment === undefined) return; // user cancelled — empty string is OK

    const confirmed = await vscode.window.showWarningMessage(
        `${verb === "approve" ? "Approve" : "Reject"} ${displayId}? This is a final state — a follow-up needs a new decision.`,
        { modal: true },
        verb === "approve" ? "Approve" : "Reject",
    );
    if (!confirmed) return;

    try {
        const fn =
            verb === "approve"
                ? client.approveDecision.bind(client)
                : client.rejectDecision.bind(client);
        await fn(displayId, {
            approver: getAgentName(),
            comment: comment.trim() || undefined,
        });
        vscode.window.showInformationMessage(
            `GovForge: ${displayId} ${verb === "approve" ? "approved" : "rejected"}.`,
        );
        await onChanged();
    } catch (err) {
        if (err instanceof ApiError && err.status === 403) {
            vscode.window.showErrorMessage(
                `GovForge: ${verb} requires \`approvals:write\` scope. Reissue your token at /account/ with that scope (or use admin).`,
            );
            return;
        }
        vscode.window.showErrorMessage(
            `GovForge: ${verb} failed — ${err instanceof Error ? err.message : String(err)}`,
        );
    }
}
