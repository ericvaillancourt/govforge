import * as vscode from "vscode";
import { backendLabelFor, currentBackendUrl } from "./commands/backend";

/**
 * Right-side status bar item that shows the current backend ('local' /
 * 'hosted' / 'custom') and opens the switch picker on click. Lives next
 * to the project-summary item from `status-bar.ts` but is intentionally
 * a separate concern: this one is about CONNECTION, the other about
 * WORKLOAD on that connection.
 */
export class BackendStatusBar implements vscode.Disposable {
    private readonly item: vscode.StatusBarItem;

    constructor() {
        this.item = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            // Lower priority = further right; we want this in a stable spot,
            // not bouncing every time `tsc-watch` or `eslint` join the row.
            -50,
        );
        this.item.command = "govforge.switchBackend";
    }

    show(): void {
        this.refresh();
        this.item.show();
    }

    dispose(): void {
        this.item.dispose();
    }

    refresh(): void {
        const url = currentBackendUrl();
        const label = backendLabelFor(url);
        const icon = label === "hosted" ? "$(globe)" : "$(plug)";
        this.item.text = `${icon} GovForge: ${label}`;
        this.item.tooltip = `GovForge backend: ${url}\nClick to switch.`;
    }
}
