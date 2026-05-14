import * as crypto from "node:crypto";
import * as vscode from "vscode";
import { ApiError, GovForgeClient } from "../api/client";
import type {
    FormOptions,
    ToExtension,
    ToWebview,
} from "./messages";

/**
 * Hosts every React webview form. Each `openForm(name, options)` call
 * spawns a fresh `WebviewPanel` to the right of the editor, injects the
 * form options via `window.__GF_FORM__`, and listens for one `submit`
 * (or `cancel`) message.
 *
 * On submit, the host calls the right GovForgeClient method and posts
 * the result back to the webview. The webview shows a brief "✓ Done"
 * before the host disposes the panel and the parent extension refreshes
 * the trees + diagnostics.
 *
 * The forms themselves live in `vscode/webview/forms/`. Type contracts
 * are in `messages.ts` and shared between both ends.
 */
export class FormPanelHost implements vscode.Disposable {
    private readonly panels = new Set<vscode.WebviewPanel>();

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly client: GovForgeClient,
        private readonly onSuccess: () => void | Promise<void>,
        private readonly output?: vscode.OutputChannel,
    ) {}

    private log(line: string): void {
        this.output?.appendLine(`[form-panel] ${line}`);
    }

    dispose(): void {
        for (const p of this.panels) p.dispose();
        this.panels.clear();
    }

    /**
     * Open a form panel. The `options` discriminate on `form` so callers
     * can't accidentally pass createTask options to submitReview.
     */
    async openForm(options: FormOptions): Promise<void> {
        const titleMap: Record<FormOptions["form"], string> = {
            submitReview: `Submit review on ${"decisionId" in options ? options.decisionId : ""}`,
            createTask: "Create task",
            recordDecision: `Record decision on ${"taskId" in options ? options.taskId : ""}`,
            requestReview: `Request review on ${"decisionId" in options ? options.decisionId : ""}`,
            recordDisagreement: `Record disagreement on ${"decisionId" in options ? options.decisionId : ""}`,
        };
        const panel = vscode.window.createWebviewPanel(
            `govforge.form.${options.form}`,
            titleMap[options.form],
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "out")],
            },
        );
        panel.iconPath = new vscode.ThemeIcon("shield");
        this.panels.add(panel);
        panel.onDidDispose(() => this.panels.delete(panel));

        panel.webview.html = this.renderHtml(panel.webview, options);

        this.log(`opening form=${options.form}`);

        panel.webview.onDidReceiveMessage(async (msg: ToExtension) => {
            if (msg.type === "boot") {
                this.log(`booted ok form=${msg.form}`);
                return;
            }
            if (msg.type === "bootError") {
                this.log(`BOOT ERROR: ${msg.message}`);
                vscode.window.showErrorMessage(
                    `GovForge form failed to boot: ${msg.message}`,
                );
                return;
            }
            if (msg.type === "cancel") {
                panel.dispose();
                return;
            }
            if (msg.type !== "submit") return;

            try {
                const resultLabel = await this.handleSubmit(options, msg);
                await this.postToWebview(panel, {
                    type: "submitDone",
                    resultLabel,
                });
                await this.onSuccess();
                // Brief feedback window then close.
                setTimeout(() => panel.dispose(), 900);
            } catch (err) {
                const message =
                    err instanceof ApiError && err.status === 403
                        ? `403 — token is missing the right *:write scope. Reissue at /account/.`
                        : err instanceof Error
                          ? err.message
                          : String(err);
                await this.postToWebview(panel, {
                    type: "submitError",
                    message,
                });
            }
        });
    }

    private async postToWebview(
        panel: vscode.WebviewPanel,
        msg: ToWebview,
    ): Promise<void> {
        await panel.webview.postMessage(msg);
    }

    /**
     * Bridges the webview submit message to the matching HTTP call.
     * Returns a short human label describing what was created
     * (e.g., "TASK-014", "REV-009") for the success toast.
     */
    private async handleSubmit(
        options: FormOptions,
        msg: Extract<ToExtension, { type: "submit" }>,
    ): Promise<string> {
        if (options.form === "submitReview" && msg.form === "submitReview") {
            const out = await this.client.submitReview({
                decision_id: options.decisionId,
                reviewer_agent: msg.payload.reviewer_agent,
                status: msg.payload.status,
                summary: msg.payload.summary || undefined,
                findings: msg.payload.findings,
            });
            return out.display_id;
        }
        if (options.form === "createTask" && msg.form === "createTask") {
            const out = await this.client.createTask({
                project_path: options.projectRootPath,
                title: msg.payload.title,
                description: msg.payload.description || undefined,
                risk_level: msg.payload.risk_level,
                actor_agent: options.defaultActor,
            });
            return out.display_id;
        }
        if (options.form === "recordDecision" && msg.form === "recordDecision") {
            const out = await this.client.createDecision({
                task_id: options.taskId,
                author_agent: options.defaultAuthor,
                title: msg.payload.title,
                summary: msg.payload.summary || undefined,
                rationale: msg.payload.rationale || undefined,
                risk_level: msg.payload.risk_level,
                human_approval_required: msg.payload.human_approval_required,
            });
            return out.display_id;
        }
        if (options.form === "requestReview" && msg.form === "requestReview") {
            await this.client.requestReview({
                decision_id: options.decisionId,
                reviewer_agent: msg.payload.reviewer_agent,
                focus: msg.payload.focus.length ? msg.payload.focus : undefined,
            });
            return options.decisionId;
        }
        if (
            options.form === "recordDisagreement" &&
            msg.form === "recordDisagreement"
        ) {
            await this.client.recordDisagreement({
                decision_id: options.decisionId,
                topic: msg.payload.topic,
                author_position: msg.payload.author_position || undefined,
                reviewer_position: msg.payload.reviewer_position || undefined,
                risk_summary: msg.payload.risk_summary || undefined,
                requires_human_decision: msg.payload.requires_human_decision,
                actor_agent: options.defaultActor,
            });
            return options.decisionId;
        }
        throw new Error(`form/payload mismatch: ${options.form} vs ${msg.form}`);
    }

    private renderHtml(
        webview: vscode.Webview,
        options: FormOptions,
    ): string {
        const nonce = crypto.randomBytes(16).toString("base64");
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, "out", "webview.js"),
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, "out", "webview.css"),
        );
        const csp = [
            `default-src 'none'`,
            `style-src ${webview.cspSource} 'unsafe-inline'`,
            `script-src 'nonce-${nonce}'`,
            `font-src ${webview.cspSource}`,
            `img-src ${webview.cspSource} https: data:`,
        ].join("; ");
        const optionsJson = JSON.stringify(options).replace(/</g, "\\u003c");

        return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <link rel="stylesheet" href="${styleUri}">
    <title>GovForge form</title>
</head>
<body>
    <div id="root"><p style="opacity:0.7;padding:1rem">Loading form&hellip; (if this never disappears, the webview script failed to load — open Help &rsaquo; Toggle Developer Tools)</p></div>
    <script nonce="${nonce}">window.__GF_FORM__ = ${optionsJson};</script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}
