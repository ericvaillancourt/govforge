import * as vscode from "vscode";
import { GovForgeClient } from "./api/client";
import { BackendStatusBar } from "./backend-status-bar";
import { initializeSignedInContext, registerAuthCommands } from "./commands/auth";
import { registerApprovalCommands } from "./commands/approvals";
import { registerBackendCommands } from "./commands/backend";
import { registerDecisionCommands } from "./commands/decisions";
import { registerDisagreementCommands } from "./commands/disagreements";
import { registerProjectCommands } from "./commands/project";
import { registerReviewCommands } from "./commands/reviews";
import { registerTaskCommands } from "./commands/tasks";
import { ProjectSelection } from "./project-selection";
import { StatusBar } from "./status-bar";
import { DecisionDetailPanels } from "./views/decision-webview";
import { DecisionsTreeProvider } from "./views/decisions-tree";
import { ReviewsTreeProvider } from "./views/reviews-tree";
import { TasksTreeProvider } from "./views/tasks-tree";

export async function activate(
    context: vscode.ExtensionContext,
): Promise<void> {
    const client = new GovForgeClient(context.secrets);
    const selection = new ProjectSelection(context);

    const tasksTree = new TasksTreeProvider(client, selection);
    const decisionsTree = new DecisionsTreeProvider(client, selection);
    const reviewsTree = new ReviewsTreeProvider(client, selection);
    const statusBar = new StatusBar(client, selection);
    const backendStatusBar = new BackendStatusBar();
    const decisionPanels = new DecisionDetailPanels(client, selection);

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider("govforge.tasks", tasksTree),
        vscode.window.registerTreeDataProvider("govforge.decisions", decisionsTree),
        vscode.window.registerTreeDataProvider("govforge.reviews", reviewsTree),
        statusBar,
        backendStatusBar,
        decisionPanels,
        vscode.commands.registerCommand(
            "govforge.openDecision",
            async (displayId: string) => {
                await decisionPanels.open(displayId);
            },
        ),
    );

    const refreshAll = async () => {
        tasksTree.refresh();
        decisionsTree.refresh();
        reviewsTree.refresh();
        backendStatusBar.refresh();
        await statusBar.refresh();
    };

    registerAuthCommands(context, client, async () => {
        await refreshAll();
    });
    registerBackendCommands(context);
    registerProjectCommands(context, client, selection);
    registerTaskCommands(context, client, selection, refreshAll);
    registerDecisionCommands(context, client, selection, refreshAll);
    registerReviewCommands(context, client, selection, refreshAll);
    registerApprovalCommands(context, client, selection, refreshAll);
    registerDisagreementCommands(context, client, selection, refreshAll);

    // Switching project re-fetches everything for the new project.
    context.subscriptions.push(
        selection.onDidChange(() => {
            void refreshAll();
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("govforge.refresh", refreshAll),
        vscode.commands.registerCommand("govforge.registerProject", async () => {
            // Deferred to Phase 3 — for v0.1 we only READ. Show a hint.
            vscode.window.showInformationMessage(
                "GovForge: registering a workspace as a project is coming in v0.2. " +
                "For now, run `gf init` in your repo or use the cockpit at https://govforge.dev/.",
            );
        }),
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("govforge.apiUrl")) {
                void refreshAll();
            }
        }),
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            void refreshAll();
        }),
    );

    await initializeSignedInContext(client);
    statusBar.show();
    backendStatusBar.show();
    await refreshAll();
}

export function deactivate(): void {
    /* nothing — VS Code disposes everything in context.subscriptions */
}
