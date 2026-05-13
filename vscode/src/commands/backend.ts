import * as vscode from "vscode";
import { GovForgeClient } from "../api/client";

export const BACKEND_PRESETS = {
    local: "http://127.0.0.1:8787",
    hosted: "https://api.govforge.dev",
} as const;

/**
 * Short label for the current `govforge.apiUrl`: 'local' for the loopback
 * preset, 'hosted' for `api.govforge.dev`, 'custom' for anything else.
 * The full URL goes in the tooltip — see status-bar.ts.
 */
export function backendLabelFor(url: string): "local" | "hosted" | "custom" {
    const normalized = url.replace(/\/$/, "");
    if (normalized === BACKEND_PRESETS.local) return "local";
    if (normalized === BACKEND_PRESETS.hosted) return "hosted";
    return "custom";
}

export function currentBackendUrl(): string {
    return vscode.workspace
        .getConfiguration("govforge")
        .get<string>("apiUrl", BACKEND_PRESETS.local)
        .replace(/\/$/, "");
}

export function registerBackendCommands(
    context: vscode.ExtensionContext,
    client: GovForgeClient,
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand("govforge.switchBackend", async () => {
            const current = currentBackendUrl();
            const items: (vscode.QuickPickItem & { url?: string; custom?: true })[] = [
                {
                    label: "$(plug) Local",
                    description: BACKEND_PRESETS.local,
                    detail: "Use a `gf api serve` instance running on your machine.",
                    picked: current === BACKEND_PRESETS.local,
                    url: BACKEND_PRESETS.local,
                },
                {
                    label: "$(globe) Hosted",
                    description: BACKEND_PRESETS.hosted,
                    detail: "Use api.govforge.dev (your account at govforge.dev).",
                    picked: current === BACKEND_PRESETS.hosted,
                    url: BACKEND_PRESETS.hosted,
                },
                {
                    label: "$(edit) Custom URL…",
                    detail: "Point at another instance.",
                    custom: true,
                },
            ];
            const pick = await vscode.window.showQuickPick(items, {
                title: "GovForge: choose backend",
                placeHolder: `Current: ${current}`,
            });
            if (!pick) return;

            let url = pick.url;
            if (pick.custom) {
                const entered = await vscode.window.showInputBox({
                    title: "GovForge: custom backend URL",
                    value: current,
                    prompt: "Full base URL, e.g. http://192.168.1.10:8787",
                    ignoreFocusOut: true,
                    validateInput: (v) =>
                        /^https?:\/\/[^\s]+$/.test(v.trim())
                            ? null
                            : "Must be a valid http(s):// URL",
                });
                if (!entered) return;
                url = entered.trim().replace(/\/$/, "");
            }
            if (!url || url === current) return;

            // Scope: Global by default, but offer per-workspace override when
            // there's a workspace open. Skipping the second prompt for users
            // with no workspace folders means single-click switch for the
            // most common case.
            let target = vscode.ConfigurationTarget.Global;
            if ((vscode.workspace.workspaceFolders ?? []).length > 0) {
                const scope = await vscode.window.showQuickPick(
                    [
                        {
                            label: "$(globe) Apply globally",
                            detail: "Updates User Settings — affects every workspace.",
                            target: vscode.ConfigurationTarget.Global,
                        },
                        {
                            label: "$(folder) Apply to this workspace only",
                            detail: "Writes to this workspace's .vscode/settings.json.",
                            target: vscode.ConfigurationTarget.Workspace,
                        },
                    ],
                    {
                        title: "GovForge: where should this apply?",
                        placeHolder: "Scope of the change",
                    },
                );
                if (!scope) return;
                target = scope.target;
            }

            await vscode.workspace
                .getConfiguration("govforge")
                .update("apiUrl", url, target);

            // The setting change fires onDidChangeConfiguration in
            // extension.ts → refreshAll(). We additionally probe whether
            // the NEW backend already has a stored token. If it does,
            // tell the user — they're already signed in there. If not,
            // offer to sign in right now (this is the whole point of the
            // per-backend-token rewiring: switch flows shouldn't blank
            // out the cockpit until the user remembers to paste again).
            const scopeLabel =
                target === vscode.ConfigurationTarget.Workspace
                    ? "this workspace"
                    : "globally";
            const hasToken = await client.hasToken();
            if (hasToken) {
                vscode.window.showInformationMessage(
                    `GovForge backend → ${url} (${scopeLabel}). Existing token reused.`,
                );
            } else {
                const action = await vscode.window.showInformationMessage(
                    `GovForge backend → ${url} (${scopeLabel}). No token saved for this backend yet.`,
                    "Sign in now",
                    "Later",
                );
                if (action === "Sign in now") {
                    await vscode.commands.executeCommand("govforge.signIn");
                }
            }
        }),
    );
}
