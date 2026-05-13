import * as vscode from "vscode";
import { getAgentName } from "../agent";
import {
    ApiError,
    FindingCat,
    GovForgeClient,
    ReviewVerdict,
    Severity,
} from "../api/client";
import type { DecisionOut } from "../api/types";
import type { FormPanelHost } from "../forms/form-panel";
import type { ProjectSelection } from "../project-selection";
import { DecisionItem } from "../views/decisions-tree";
import { ReviewItem } from "../views/reviews-tree";
import { resolveActiveProject } from "../workspace";

const VERDICT_ORDER: ReviewVerdict[] = [
    "changes_requested",
    "approved",
    "commented",
    "rejected",
];

const SEVERITIES: Severity[] = ["info", "low", "medium", "high", "critical"];
const CATEGORIES: FindingCat[] = [
    "security",
    "performance",
    "architecture",
    "bug",
    "maintainability",
    "tests",
    "docs",
    "accessibility",
];

export function registerReviewCommands(
    context: vscode.ExtensionContext,
    client: GovForgeClient,
    selection: ProjectSelection,
    onChanged: () => void | Promise<void>,
    formPanels: FormPanelHost,
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "govforge.requestReview",
            (decisionItem?: DecisionItem) =>
                requestReview(client, selection, onChanged, decisionItem),
        ),
        vscode.commands.registerCommand(
            "govforge.submitReview",
            (reviewItem?: ReviewItem) =>
                submitReview(client, selection, formPanels, reviewItem),
        ),
    );
}

async function pickDecision(
    client: GovForgeClient,
    selection: ProjectSelection,
): Promise<DecisionOut | undefined> {
    const project = await resolveActiveProject(client, selection);
    if (!project) {
        vscode.window.showWarningMessage("GovForge: pick a project first.");
        return undefined;
    }
    const decisions = await client.listDecisions(project.root_path);
    if (decisions.length === 0) {
        vscode.window.showWarningMessage(
            "GovForge: no decisions on this project.",
        );
        return undefined;
    }
    const pick = await vscode.window.showQuickPick(
        decisions.map((d) => ({
            label: `${d.display_id} ${d.title}`,
            description: `${d.status} · ${d.risk_level}`,
            decision: d,
        })),
        { title: "GovForge: select decision", ignoreFocusOut: true },
    );
    return pick?.decision;
}

async function requestReview(
    client: GovForgeClient,
    selection: ProjectSelection,
    onChanged: () => void | Promise<void>,
    decisionItem: DecisionItem | undefined,
): Promise<void> {
    const decision = decisionItem?.decision ?? (await pickDecision(client, selection));
    if (!decision) return;

    const reviewer = await vscode.window.showInputBox({
        title: `GovForge: request review on ${decision.display_id}`,
        prompt: "Reviewer agent name",
        placeHolder: "e.g. codex, claude, eric",
        ignoreFocusOut: true,
        validateInput: (v) => (v.trim().length === 0 ? "Required" : null),
    });
    if (!reviewer) return;

    const focusRaw = await vscode.window.showInputBox({
        title: "Focus areas (optional, comma-separated)",
        placeHolder: "security,tests,architecture",
        ignoreFocusOut: true,
    });
    const focus = focusRaw
        ? focusRaw
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
        : undefined;

    try {
        await client.requestReview({
            decision_id: decision.display_id,
            reviewer_agent: reviewer.trim(),
            focus,
            actor_agent: getAgentName(),
        });
        vscode.window.showInformationMessage(
            `GovForge: review requested on ${decision.display_id} from ${reviewer.trim()}.`,
        );
        await onChanged();
    } catch (err) {
        showHttpError("request review", err);
    }
}

async function submitReview(
    client: GovForgeClient,
    selection: ProjectSelection,
    formPanels: FormPanelHost,
    reviewItem: ReviewItem | undefined,
): Promise<void> {
    // The submit-review endpoint creates a NEW review; `reviewItem` (when
    // the user right-clicks a review row) tells us which decision to
    // attach the new review to. From the palette, we ask.
    let decision: DecisionOut | undefined;
    if (reviewItem) {
        const project = await resolveActiveProject(client, selection);
        if (!project) {
            vscode.window.showWarningMessage("GovForge: pick a project first.");
            return;
        }
        const decisions = await client.listDecisions(project.root_path);
        decision = decisions.find((d) => d.id === reviewItem.review.decision_id);
        if (!decision) {
            vscode.window.showErrorMessage(
                `GovForge: can't resolve the decision for ${reviewItem.review.display_id}.`,
            );
            return;
        }
    } else {
        decision = await pickDecision(client, selection);
        if (!decision) return;
    }

    await formPanels.openForm({
        form: "submitReview",
        decisionId: decision.display_id,
        decisionTitle: decision.title,
        defaultReviewer: getAgentName(),
        severities: SEVERITIES,
        categories: CATEGORIES,
        verdicts: VERDICT_ORDER,
    });
}

function showHttpError(action: string, err: unknown): void {
    if (err instanceof ApiError && err.status === 403) {
        vscode.window.showErrorMessage(
            `GovForge: ${action} requires more scope than this token has (403). Reissue the token with the right \`*:write\` scope at /account/.`,
        );
        return;
    }
    vscode.window.showErrorMessage(
        `GovForge: ${action} failed — ${err instanceof Error ? err.message : String(err)}`,
    );
}
