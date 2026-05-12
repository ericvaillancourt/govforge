import * as vscode from "vscode";
import { GovForgeClient } from "../api/client";
import type { TaskOut } from "../api/types";
import { resolveActiveProject } from "../workspace";

class TaskItem extends vscode.TreeItem {
    constructor(task: TaskOut) {
        super(`${task.display_id} ${task.title}`, vscode.TreeItemCollapsibleState.None);
        this.description = `${task.status} · ${task.risk_level}`;
        this.tooltip = task.description ?? task.title;
        this.contextValue = "govforge.task";
        this.iconPath = new vscode.ThemeIcon(iconForStatus(task.status));
    }
}

function iconForStatus(status: string): string {
    switch (status) {
        case "open":
        case "in_progress":
            return "circle-outline";
        case "review_required":
            return "eye";
        case "approved":
            return "check";
        case "rejected":
            return "x";
        case "closed":
            return "circle-slash";
        default:
            return "circle";
    }
}

export class TasksTreeProvider
    implements vscode.TreeDataProvider<TaskItem>
{
    private readonly _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChange.event;

    constructor(private readonly client: GovForgeClient) {}

    refresh(): void {
        this._onDidChange.fire();
    }

    getTreeItem(el: TaskItem): vscode.TreeItem {
        return el;
    }

    async getChildren(): Promise<TaskItem[]> {
        const project = await resolveActiveProject(this.client);
        if (!project) {
            return [];
        }
        try {
            const tasks = await this.client.listTasks(project.root_path);
            return tasks.map((t) => new TaskItem(t));
        } catch {
            return [];
        }
    }
}
