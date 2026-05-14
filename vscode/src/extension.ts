import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
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
import { FindingsAnnotator } from "./findings-annotator";
import { FocusMode, type Role } from "./focus-mode";
import { FormPanelHost } from "./forms/form-panel";
import { ProjectSelection } from "./project-selection";
import { ScopeState } from "./scope-state";
import { StatusBar } from "./status-bar";
import { DecisionDetailPanels } from "./views/decision-webview";
import { DecisionsTreeProvider } from "./views/decisions-tree";
import { ReviewsTreeProvider } from "./views/reviews-tree";
import { TasksTreeProvider } from "./views/tasks-tree";
import type { TokenScope } from "./api/client";

export async function activate(
    context: vscode.ExtensionContext,
): Promise<void> {
    const output = vscode.window.createOutputChannel("GovForge");
    context.subscriptions.push(output);
    const apiUrl = vscode.workspace
        .getConfiguration("govforge")
        .get<string>("apiUrl", "http://127.0.0.1:8787");
    output.appendLine(`[activate] apiUrl=${apiUrl}`);

    const client = new GovForgeClient(context.secrets);
    client.setFallback(makeAuthTomlFallback(output));
    const tokenAtBoot = await client.getToken();
    output.appendLine(
        tokenAtBoot
            ? `[activate] token found for backend ${apiUrl} (len=${tokenAtBoot.length})`
            : `[activate] NO token at boot for backend ${apiUrl} — sign-in required`,
    );

    const selection = new ProjectSelection(context);

    const tasksTree = new TasksTreeProvider(client, selection);
    const decisionsTree = new DecisionsTreeProvider(client, selection);
    const reviewsTree = new ReviewsTreeProvider(client, selection);
    const statusBar = new StatusBar(client, selection);
    const backendStatusBar = new BackendStatusBar();
    const decisionPanels = new DecisionDetailPanels(client, selection);
    const annotator = new FindingsAnnotator(client, selection);
    const formPanels = new FormPanelHost(
        context.extensionUri,
        client,
        () => refreshAll(),
        output,
    );
    const scopeState = new ScopeState(client, output);
    const focusMode = new FocusMode(context, output);

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider("govforge.tasks", tasksTree),
        vscode.window.registerTreeDataProvider("govforge.decisions", decisionsTree),
        vscode.window.registerTreeDataProvider("govforge.reviews", reviewsTree),
        statusBar,
        backendStatusBar,
        decisionPanels,
        annotator,
        formPanels,
        scopeState,
        focusMode,
        vscode.commands.registerCommand(
            "govforge.openDecision",
            async (displayId: string) => {
                await decisionPanels.open(displayId);
            },
        ),
        vscode.commands.registerCommand("govforge.switchFocus", () =>
            focusMode.pick(),
        ),
    );

    const applyContextKeys = async (): Promise<void> => {
        const keys = computeContextKeys(scopeState.scopes(), focusMode.role());
        for (const [k, v] of Object.entries(keys)) {
            await vscode.commands.executeCommand("setContext", k, v);
        }
    };
    context.subscriptions.push(
        scopeState.onDidChange(() => void applyContextKeys()),
        focusMode.onDidChange(() => void applyContextKeys()),
    );

    const refreshAll = async () => {
        tasksTree.refresh();
        decisionsTree.refresh();
        reviewsTree.refresh();
        backendStatusBar.refresh();
        await Promise.all([statusBar.refresh(), annotator.refresh()]);
    };

    registerAuthCommands(context, client, async (signedIn) => {
        if (signedIn) await scopeState.refresh();
        else scopeState.clear();
        await applyContextKeys();
        await refreshAll();
    });
    registerBackendCommands(context, client);
    registerProjectCommands(context, client, selection);
    registerTaskCommands(context, client, selection, refreshAll, formPanels);
    registerDecisionCommands(context, client, selection, refreshAll, formPanels);
    registerReviewCommands(context, client, selection, refreshAll, formPanels);
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
        vscode.workspace.onDidChangeConfiguration(async (e) => {
            if (e.affectsConfiguration("govforge.apiUrl")) {
                // The current backend changed → re-resolve signedIn (the
                // token store is keyed per-backend, so the new URL may or
                // may not have one) and re-fetch scopes for the new token.
                const signedIn = await initializeSignedInContext(client);
                if (signedIn) await scopeState.refresh();
                else scopeState.clear();
                await applyContextKeys();
                await refreshAll();
            }
        }),
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            void refreshAll();
        }),
    );

    const signedIn = await initializeSignedInContext(client);
    if (signedIn) await scopeState.refresh();
    await applyContextKeys();
    statusBar.show();
    backendStatusBar.show();
    await refreshAll();
}

// -----------------------------------------------------------------------------
// Role / scope visibility model
// -----------------------------------------------------------------------------
//
// Final visibility of each write command = scopeAllows ∩ focusIncludes.
// If scopes are unknown (no /me yet, or backend returned 404), scopeAllows
// is treated as TRUE everywhere — non-breaking fallback.

const AUTHOR_CMDS = [
    "canCreateTask",
    "canRecordDecision",
    "canAttachGitDiff",
    "canRunPolicyChecks",
    "canRequestReview",
] as const;
const REVIEWER_CMDS = ["canSubmitReview", "canRecordDisagreement"] as const;
const APPROVER_CMDS = ["canApprove", "canReject"] as const;
type CapKey =
    | (typeof AUTHOR_CMDS)[number]
    | (typeof REVIEWER_CMDS)[number]
    | (typeof APPROVER_CMDS)[number];

function computeContextKeys(
    scopes: TokenScope[] | undefined,
    role: Role,
): Record<string, boolean> {
    const has = (s: TokenScope): boolean => {
        if (scopes === undefined) return true; // unknown → show everything
        return scopes.includes(s) || scopes.includes("admin");
    };
    const inFocus = (groupRole: Role): boolean =>
        role === "all" || role === groupRole;

    const caps: Record<CapKey, boolean> = {
        canCreateTask: has("tasks:write") && inFocus("author"),
        canRecordDecision: has("decisions:write") && inFocus("author"),
        canAttachGitDiff: has("decisions:write") && inFocus("author"),
        canRunPolicyChecks: has("decisions:write") && inFocus("author"),
        canRequestReview: has("reviews:write") && inFocus("author"),
        canSubmitReview: has("reviews:write") && inFocus("reviewer"),
        canRecordDisagreement: has("reviews:write") && inFocus("reviewer"),
        canApprove: has("approvals:write") && inFocus("approver"),
        canReject: has("approvals:write") && inFocus("approver"),
    };

    // True iff the token has at least one write scope. Used by welcome views
    // to show a "your token is read-only" hint instead of an empty palette.
    const hasAnyWriteScope =
        scopes === undefined
            ? true
            : scopes.some(
                  (s) =>
                      s.endsWith(":write") ||
                      s === "admin",
              );

    const result: Record<string, boolean> = { "govforge.hasAnyWriteScope": hasAnyWriteScope };
    for (const [k, v] of Object.entries(caps)) {
        result[`govforge.${k}`] = v;
    }
    return result;
}

export function deactivate(): void {
    /* nothing — VS Code disposes everything in context.subscriptions */
}

/**
 * Disk-backed token fallback targeting the same `~/.config/govforge/auth.toml`
 * file the `gf` CLI manages. Used only when SecretStorage drops writes
 * (keyring unavailable). Same chmod 0600 model as gh, aws, gcloud, kubectl.
 */
function makeAuthTomlFallback(
    output: vscode.OutputChannel,
): import("./api/client").TokenFallback {
    const home = os.homedir();
    const authPath = path.join(home, ".config", "govforge", "auth.toml");
    let warnedOnce = false;

    return {
        async read(): Promise<string | undefined> {
            try {
                const raw = await fs.readFile(authPath, "utf8");
                for (const line of raw.split("\n")) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith("#")) continue;
                    const eq = trimmed.indexOf("=");
                    if (eq < 0) continue;
                    const key = trimmed.slice(0, eq).trim();
                    if (key !== "token") continue;
                    let val = trimmed.slice(eq + 1).trim();
                    if (
                        (val.startsWith('"') && val.endsWith('"')) ||
                        (val.startsWith("'") && val.endsWith("'"))
                    ) {
                        val = val.slice(1, -1);
                    }
                    return val || undefined;
                }
                return undefined;
            } catch (err) {
                const code = (err as NodeJS.ErrnoException).code;
                if (code !== "ENOENT") {
                    output.appendLine(
                        `[auth.toml] read failed: ${err instanceof Error ? err.message : String(err)}`,
                    );
                }
                return undefined;
            }
        },
        async write(value: string | undefined): Promise<void> {
            try {
                if (value === undefined) {
                    await fs.rm(authPath, { force: true });
                    return;
                }
                await fs.mkdir(path.dirname(authPath), {
                    recursive: true,
                    mode: 0o700,
                });
                await fs.writeFile(
                    authPath,
                    `token = ${JSON.stringify(value)}\n`,
                    { mode: 0o600 },
                );
                // writeFile honors mode only on create; force it for overwrites.
                await fs.chmod(authPath, 0o600);
            } catch (err) {
                output.appendLine(
                    `[auth.toml] write failed: ${err instanceof Error ? err.message : String(err)}`,
                );
                throw err;
            }
        },
        warn(msg: string): void {
            if (warnedOnce) return;
            warnedOnce = true;
            void vscode.window.showWarningMessage(msg);
        },
    };
}
