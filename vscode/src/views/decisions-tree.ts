import * as vscode from "vscode";
import { GovForgeClient } from "../api/client";
import type { DecisionOut } from "../api/types";
import { resolveActiveProject } from "../workspace";

class DecisionItem extends vscode.TreeItem {
    constructor(decision: DecisionOut) {
        super(
            `${decision.display_id} ${decision.title}`,
            vscode.TreeItemCollapsibleState.None,
        );
        this.description = `${decision.status} · ${decision.risk_level}`;
        this.tooltip = decision.summary ?? decision.title;
        this.contextValue = "govforge.decision";
        this.iconPath = new vscode.ThemeIcon(iconForStatus(decision.status));
    }
}

function iconForStatus(status: string): string {
    switch (status) {
        case "draft":
            return "edit";
        case "review_required":
            return "eye";
        case "changes_requested":
            return "warning";
        case "approved":
            return "check";
        case "rejected":
            return "x";
        default:
            return "circle";
    }
}

export class DecisionsTreeProvider
    implements vscode.TreeDataProvider<DecisionItem>
{
    private readonly _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChange.event;

    constructor(private readonly client: GovForgeClient) {}

    refresh(): void {
        this._onDidChange.fire();
    }

    getTreeItem(el: DecisionItem): vscode.TreeItem {
        return el;
    }

    async getChildren(): Promise<DecisionItem[]> {
        const project = await resolveActiveProject(this.client);
        if (!project) {
            return [];
        }
        try {
            const decisions = await this.client.listDecisions(project.root_path);
            return decisions.map((d) => new DecisionItem(d));
        } catch {
            return [];
        }
    }
}
