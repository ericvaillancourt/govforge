import * as vscode from "vscode";
import { GovForgeClient } from "./api/client";
import type { ProjectSelection } from "./project-selection";
import { resolveActiveProject } from "./workspace";

/**
 * Left-side status bar item that shows the active GovForge project plus a
 * compact summary of pending work. Clicking it opens the project picker —
 * "switch project" is the most common follow-up action after looking at
 * the summary, so the item targets that command rather than the static
 * "open sidebar".
 */
export class StatusBar implements vscode.Disposable {
    private readonly item: vscode.StatusBarItem;

    constructor(
        private readonly client: GovForgeClient,
        private readonly selection: ProjectSelection,
    ) {
        this.item = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            50,
        );
        this.item.command = "govforge.switchProject";
        this.item.tooltip = "GovForge — click to switch project";
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
            this.item.tooltip = "GovForge — click to switch project (sign in first)";
            return;
        }
        const project = await resolveActiveProject(this.client, this.selection);
        if (!project) {
            this.item.text = "$(shield) GovForge: pick a project";
            this.item.tooltip = "GovForge — click to choose which project to display";
            return;
        }
        this.item.tooltip = `GovForge — project '${project.name}' (${project.root_path})\nClick to switch.`;
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
