import * as vscode from "vscode";
import { GovForgeClient } from "./api/client";
import { initializeSignedInContext, registerAuthCommands } from "./commands/auth";
import { StatusBar } from "./status-bar";
import { DecisionsTreeProvider } from "./views/decisions-tree";
import { ReviewsTreeProvider } from "./views/reviews-tree";
import { TasksTreeProvider } from "./views/tasks-tree";

export async function activate(
    context: vscode.ExtensionContext,
): Promise<void> {
    const client = new GovForgeClient(context.secrets);

    const tasksTree = new TasksTreeProvider(client);
    const decisionsTree = new DecisionsTreeProvider(client);
    const reviewsTree = new ReviewsTreeProvider(client);
    const statusBar = new StatusBar(client);

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider("govforge.tasks", tasksTree),
        vscode.window.registerTreeDataProvider("govforge.decisions", decisionsTree),
        vscode.window.registerTreeDataProvider("govforge.reviews", reviewsTree),
        statusBar,
    );

    const refreshAll = async () => {
        tasksTree.refresh();
        decisionsTree.refresh();
        reviewsTree.refresh();
        await statusBar.refresh();
    };

    registerAuthCommands(context, client, async () => {
        await refreshAll();
    });

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
    await refreshAll();
}

export function deactivate(): void {
    /* nothing — VS Code disposes everything in context.subscriptions */
}
