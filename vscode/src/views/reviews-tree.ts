import * as vscode from "vscode";
import { GovForgeClient } from "../api/client";
import type { ReviewOut } from "../api/types";
import type { ProjectSelection } from "../project-selection";
import { resolveActiveProject } from "../workspace";

export class ReviewItem extends vscode.TreeItem {
    constructor(public readonly review: ReviewOut) {
        super(
            `${review.display_id}`,
            vscode.TreeItemCollapsibleState.None,
        );
        this.description = `${review.status} · ${review.findings.length} finding${review.findings.length === 1 ? "" : "s"}`;
        this.tooltip = review.summary ?? review.display_id;
        this.contextValue = "govforge.review";
        this.iconPath = new vscode.ThemeIcon(iconForStatus(review.status));
    }
}

function iconForStatus(status: string): string {
    switch (status) {
        case "approved":
            return "check";
        case "changes_requested":
            return "warning";
        case "rejected":
            return "x";
        case "commented":
            return "comment";
        default:
            return "circle";
    }
}

export class ReviewsTreeProvider
    implements vscode.TreeDataProvider<ReviewItem>
{
    private readonly _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChange.event;

    constructor(
        private readonly client: GovForgeClient,
        private readonly selection: ProjectSelection,
    ) {}

    refresh(): void {
        this._onDidChange.fire();
    }

    getTreeItem(el: ReviewItem): vscode.TreeItem {
        return el;
    }

    async getChildren(): Promise<ReviewItem[]> {
        const project = await resolveActiveProject(this.client, this.selection);
        if (!project) {
            return [];
        }
        try {
            const reviews = await this.client.listReviews(project.root_path);
            return reviews.map((r) => new ReviewItem(r));
        } catch {
            return [];
        }
    }
}
