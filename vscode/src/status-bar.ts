import * as vscode from "vscode";
import { GovForgeClient } from "./api/client";
import { resolveActiveProject } from "./workspace";

/**
 * Left-side status bar item that shows the active GovForge project plus a
 * compact summary of pending work. Clicking it focuses the GovForge view
 * container. Refreshed on demand by the extension whenever data changes.
 */
export class StatusBar implements vscode.Disposable {
    private readonly item: vscode.StatusBarItem;

    constructor(private readonly client: GovForgeClient) {
        this.item = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            50,
        );
        this.item.command = "workbench.view.extension.govforge";
        this.item.tooltip = "Open GovForge sidebar";
    }

    show(): void {
        this.item.show();
    }

    dispose(): void {
        this.item.dispose();
    }

    async refresh(): Promise<void> {
        const token = await this.client.getToken();
        if (!token) {
            this.item.text = "$(shield) GovForge: signed out";
            return;
        }
        const project = await resolveActiveProject(this.client);
        if (!project) {
            this.item.text = "$(shield) GovForge: no project";
            return;
        }
        try {
            const [tasks, decisions, reviews] = await Promise.all([
                this.client.listTasks(project.root_path),
                this.client.listDecisions(project.root_path),
                this.client.listReviews(project.root_path, true),
            ]);
            const openReviews = reviews.length;
            this.item.text =
                `$(shield) ${project.name}` +
                ` · ${tasks.length} task${tasks.length === 1 ? "" : "s"}` +
                ` · ${decisions.length} dec` +
                (openReviews > 0 ? ` · ${openReviews} review${openReviews === 1 ? "" : "s"} open` : "");
        } catch {
            this.item.text = "$(shield) GovForge: unreachable";
        }
    }
}
