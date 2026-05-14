import * as vscode from "vscode";

export type Role = "all" | "author" | "reviewer" | "approver";

const STATE_KEY = "govforge.focusMode";
const DEFAULT_ROLE: Role = "all";

const LABELS: Record<Role, { label: string; description: string; icon: string }> = {
    all: {
        label: "All",
        description: "Show every command your token allows",
        icon: "$(person)",
    },
    author: {
        label: "Author",
        description: "Create tasks, record decisions, request reviews",
        icon: "$(edit)",
    },
    reviewer: {
        label: "Reviewer",
        description: "Submit reviews, record disagreements",
        icon: "$(comment-discussion)",
    },
    approver: {
        label: "Approver",
        description: "Approve or reject decisions",
        icon: "$(check)",
    },
};

/**
 * Manual workflow narrowing on top of the token's scopes. A user with a
 * full-scope token can pick `reviewer` to focus the UI on review work
 * without losing their other capabilities — they re-pick `all` to get
 * everything back.
 *
 * Persisted in `globalState` (per-machine, survives VS Code restarts).
 * Surfaced as a left-side status-bar item that opens a QuickPick.
 */
export class FocusMode implements vscode.Disposable {
    private _role: Role;
    private readonly _emitter = new vscode.EventEmitter<void>();
    readonly onDidChange = this._emitter.event;
    private readonly statusBar: vscode.StatusBarItem;

    constructor(
        private readonly context: vscode.ExtensionContext,
        output?: vscode.OutputChannel,
    ) {
        const stored = context.globalState.get<string>(STATE_KEY);
        this._role = isRole(stored) ? stored : DEFAULT_ROLE;

        // Right-aligned with high priority so it sits left of the project
        // summary + backend status. Left-side items get crowded by other
        // extensions (eslint, git, etc.) and tend to scroll out of view.
        this.statusBar = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100,
        );
        this.statusBar.command = "govforge.switchFocus";
        this.statusBar.tooltip =
            "GovForge focus mode — narrow the visible commands to one workflow.";
        this.refreshStatusBar();
        this.statusBar.show();
        output?.appendLine(
            `[focus-mode] status bar shown — role=${this._role}`,
        );
    }

    dispose(): void {
        this._emitter.dispose();
        this.statusBar.dispose();
    }

    role(): Role {
        return this._role;
    }

    async pick(): Promise<void> {
        const items: (vscode.QuickPickItem & { role: Role })[] = (
            Object.keys(LABELS) as Role[]
        ).map((r) => ({
            label: `${LABELS[r].icon} ${LABELS[r].label}`,
            description: LABELS[r].description,
            picked: r === this._role,
            role: r,
        }));
        const choice = await vscode.window.showQuickPick(items, {
            title: "GovForge: focus on which role?",
            ignoreFocusOut: true,
        });
        if (!choice || choice.role === this._role) return;
        this._role = choice.role;
        await this.context.globalState.update(STATE_KEY, this._role);
        this.refreshStatusBar();
        this._emitter.fire();
    }

    private refreshStatusBar(): void {
        const { icon, label } = LABELS[this._role];
        this.statusBar.text = `${icon} Focus: ${label}`;
    }
}

function isRole(value: unknown): value is Role {
    return (
        value === "all" ||
        value === "author" ||
        value === "reviewer" ||
        value === "approver"
    );
}
