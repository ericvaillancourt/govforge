import * as vscode from "vscode";
import { getAgentName } from "../agent";
import {
    ApiError,
    FindingCat,
    FindingInput,
    GovForgeClient,
    ReviewVerdict,
    Severity,
} from "../api/client";
import type { DecisionOut } from "../api/types";
import type { ProjectSelection } from "../project-selection";
import { DecisionItem } from "../views/decisions-tree";
import { ReviewItem } from "../views/reviews-tree";
import { resolveActiveProject } from "../workspace";

const VERDICTS: { label: ReviewVerdict; description: string }[] = [
    { label: "approved", description: "ship it" },
    { label: "changes_requested", description: "needs work before approval" },
    { label: "commented", description: "informational only, no gate" },
    { label: "rejected", description: "do not ship" },
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
                submitReview(client, selection, onChanged, reviewItem),
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
    onChanged: () => void | Promise<void>,
    reviewItem: ReviewItem | undefined,
): Promise<void> {
    // The submit-review endpoint creates a NEW review; the existing
    // `reviewItem` is informational (what we're "responding to"). The
    // user can either start from an open review tree-row (most common
    // for reviewer-persona workflows) or from the palette and pick the
    // decision directly.
    let decisionId: string | undefined;
    if (reviewItem) {
        // ReviewOut.decision_id is the UUID; we need a display_id. Look it up.
        const project = await resolveActiveProject(client, selection);
        if (!project) {
            vscode.window.showWarningMessage("GovForge: pick a project first.");
            return;
        }
        const decisions = await client.listDecisions(project.root_path);
        decisionId = decisions.find((d) => d.id === reviewItem.review.decision_id)?.display_id;
        if (!decisionId) {
            vscode.window.showErrorMessage(
                `GovForge: can't resolve the decision for ${reviewItem.review.display_id}.`,
            );
            return;
        }
    } else {
        const decision = await pickDecision(client, selection);
        if (!decision) return;
        decisionId = decision.display_id;
    }

    const reviewer = await vscode.window.showInputBox({
        title: `GovForge: submit review on ${decisionId}`,
        prompt: "Reviewer agent name (you)",
        value: getAgentName(),
        ignoreFocusOut: true,
        validateInput: (v) => (v.trim().length === 0 ? "Required" : null),
    });
    if (!reviewer) return;

    const statusPick = await vscode.window.showQuickPick(VERDICTS, {
        title: "Verdict",
        ignoreFocusOut: true,
    });
    if (!statusPick) return;

    const summary = await vscode.window.showInputBox({
        title: "Review summary (optional)",
        placeHolder: "One-line takeaway",
        ignoreFocusOut: true,
    });

    const findings = await collectFindings();
    if (findings === undefined) return; // user cancelled

    try {
        const out = await client.submitReview({
            decision_id: decisionId,
            reviewer_agent: reviewer.trim(),
            status: statusPick.label,
            summary: summary?.trim() || undefined,
            findings,
        });
        vscode.window.showInformationMessage(
            `GovForge: ${out.display_id} submitted (${out.status}) with ${findings.length} finding${findings.length === 1 ? "" : "s"}.`,
        );
        await onChanged();
    } catch (err) {
        showHttpError("submit review", err);
    }
}

async function collectFindings(): Promise<FindingInput[] | undefined> {
    const findings: FindingInput[] = [];
    while (true) {
        const action = await vscode.window.showQuickPick(
            [
                {
                    label: `$(check) Submit now${findings.length ? ` (${findings.length} finding${findings.length === 1 ? "" : "s"})` : " — no findings"}`,
                    value: "submit" as const,
                },
                { label: "$(add) Add a finding", value: "add" as const },
                { label: "$(close) Cancel", value: "cancel" as const },
            ],
            {
                title: `Findings (${findings.length} so far)`,
                ignoreFocusOut: true,
            },
        );
        if (!action || action.value === "cancel") return undefined;
        if (action.value === "submit") return findings;

        const finding = await promptFinding();
        if (finding) {
            findings.push(finding);
        }
    }
}

async function promptFinding(): Promise<FindingInput | undefined> {
    const severity = await vscode.window.showQuickPick(SEVERITIES, {
        title: "Finding — severity",
        ignoreFocusOut: true,
    });
    if (!severity) return undefined;

    const category = await vscode.window.showQuickPick(CATEGORIES, {
        title: "Finding — category",
        ignoreFocusOut: true,
    });
    if (!category) return undefined;

    const message = await vscode.window.showInputBox({
        title: "Finding — message (required)",
        ignoreFocusOut: true,
        validateInput: (v) => (v.trim().length === 0 ? "Required" : null),
    });
    if (!message) return undefined;

    const filePath = await vscode.window.showInputBox({
        title: "Finding — file path (optional)",
        placeHolder: "e.g. backend/src/govforge/api/auth.py",
        ignoreFocusOut: true,
    });

    const lineRange = await vscode.window.showInputBox({
        title: "Finding — line range (optional, e.g. 42 or 42-60)",
        ignoreFocusOut: true,
        validateInput: (v) =>
            v && !/^\d+(-\d+)?$/.test(v.trim())
                ? "Use 'N' or 'N-M'"
                : null,
    });
    let lineStart: number | undefined;
    let lineEnd: number | undefined;
    if (lineRange?.trim()) {
        const [s, e] = lineRange.trim().split("-").map(Number);
        lineStart = s;
        lineEnd = e ?? s;
    }

    const recommendation = await vscode.window.showInputBox({
        title: "Finding — recommendation (optional)",
        placeHolder: "What to do about it",
        ignoreFocusOut: true,
    });

    return {
        severity: severity as Severity,
        category: category as FindingCat,
        message: message.trim(),
        file_path: filePath?.trim() || undefined,
        line_start: lineStart,
        line_end: lineEnd,
        recommendation: recommendation?.trim() || undefined,
    };
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
