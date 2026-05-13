import * as vscode from "vscode";
import { getAgentName } from "../agent";
import { ApiError, GovForgeClient } from "../api/client";
import type { ProjectSelection } from "../project-selection";
import { DecisionItem } from "../views/decisions-tree";
import { resolveActiveProject } from "../workspace";

export function registerDisagreementCommands(
    context: vscode.ExtensionContext,
    client: GovForgeClient,
    selection: ProjectSelection,
    onChanged: () => void | Promise<void>,
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "govforge.recordDisagreement",
            (decisionItem?: DecisionItem) =>
                recordDisagreement(client, selection, onChanged, decisionItem),
        ),
    );
}

async function recordDisagreement(
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
            vscode.window.showWarningMessage("GovForge: no decisions on this project.");
            return;
        }
        const pick = await vscode.window.showQuickPick(
            decisions.map((d) => ({
                label: `${d.display_id} ${d.title}`,
                description: `${d.status} · ${d.risk_level}`,
                id: d.display_id,
            })),
            { title: "GovForge: record disagreement on which decision?", ignoreFocusOut: true },
        );
        if (!pick) return;
        displayId = pick.id;
    }

    const topic = await vscode.window.showInputBox({
        title: `GovForge: record disagreement on ${displayId}`,
        prompt: "Topic (required, one-line)",
        placeHolder: "e.g. HS256 vs RS256 for JWT signing",
        ignoreFocusOut: true,
        validateInput: (v) => (v.trim().length === 0 ? "Required" : null),
    });
    if (!topic) return;

    const authorPosition = await vscode.window.showInputBox({
        title: "Author position (optional)",
        placeHolder: "What the author argued for",
        ignoreFocusOut: true,
    });

    const reviewerPosition = await vscode.window.showInputBox({
        title: "Reviewer position (optional)",
        placeHolder: "What the reviewer pushed back on",
        ignoreFocusOut: true,
    });

    const riskSummary = await vscode.window.showInputBox({
        title: "Risk summary (optional)",
        placeHolder: "One-line risk if the wrong call is made",
        ignoreFocusOut: true,
    });

    const humanGate = await vscode.window.showQuickPick(
        [
            { label: "Yes — needs a human tiebreaker", value: true, picked: true },
            { label: "No — already resolved or informational", value: false },
        ],
        { title: "Requires human decision?", ignoreFocusOut: true },
    );
    if (humanGate === undefined) return;

    try {
        await client.recordDisagreement({
            decision_id: displayId,
            topic: topic.trim(),
            author_position: authorPosition?.trim() || undefined,
            reviewer_position: reviewerPosition?.trim() || undefined,
            risk_summary: riskSummary?.trim() || undefined,
            requires_human_decision: humanGate.value,
            actor_agent: getAgentName(),
        });
        vscode.window.showInformationMessage(
            `GovForge: disagreement recorded on ${displayId}${humanGate.value ? " — needs human" : ""}.`,
        );
        await onChanged();
    } catch (err) {
        if (err instanceof ApiError && err.status === 403) {
            vscode.window.showErrorMessage(
                "GovForge: record disagreement requires `reviews:write` scope.",
            );
            return;
        }
        vscode.window.showErrorMessage(
            `GovForge: record disagreement failed — ${err instanceof Error ? err.message : String(err)}`,
        );
    }
}
