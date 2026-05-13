import { marked } from "marked";
import * as vscode from "vscode";
import { GovForgeClient } from "../api/client";
import type { DecisionOut, EventOut, ReviewOut } from "../api/types";
import type { ProjectSelection } from "../project-selection";
import { resolveActiveProject } from "../workspace";

/**
 * Per-decision detail panel. Shows summary + rationale (markdown), the
 * latest review findings, and the timeline. One panel per decision —
 * re-opening the same decision focuses the existing panel instead of
 * spawning duplicates.
 *
 * Phase 2 is read-only. Phases 3/4 will add action buttons that
 * post-back to the extension host through `webview.onDidReceiveMessage`.
 */
export class DecisionDetailPanels implements vscode.Disposable {
    private readonly panels = new Map<string, vscode.WebviewPanel>();

    constructor(
        private readonly client: GovForgeClient,
        private readonly selection: ProjectSelection,
    ) {}

    dispose(): void {
        for (const panel of this.panels.values()) {
            panel.dispose();
        }
        this.panels.clear();
    }

    async open(displayId: string): Promise<void> {
        const existing = this.panels.get(displayId);
        if (existing) {
            existing.reveal(vscode.ViewColumn.Active);
            await this.refresh(displayId);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            "govforge.decisionDetail",
            displayId,
            vscode.ViewColumn.Active,
            { enableScripts: false, retainContextWhenHidden: true },
        );
        panel.iconPath = new vscode.ThemeIcon("shield");
        panel.onDidDispose(() => this.panels.delete(displayId));
        this.panels.set(displayId, panel);
        await this.refresh(displayId);
    }

    private async refresh(displayId: string): Promise<void> {
        const panel = this.panels.get(displayId);
        if (!panel) return;
        try {
            const [decision, timeline] = await Promise.all([
                this.client.getDecision(displayId),
                this.client.getDecisionTimeline(displayId),
            ]);
            const project = await resolveActiveProject(this.client, this.selection);
            const allReviews = project
                ? await this.client.listReviews(project.root_path).catch(() => [])
                : [];
            const reviews = allReviews.filter((r) => r.decision_id === decision.id);
            panel.title = `${decision.display_id}: ${decision.title}`;
            panel.webview.html = renderDecisionHtml(panel.webview, decision, reviews, timeline);
        } catch (err) {
            panel.webview.html = renderErrorHtml(
                panel.webview,
                err instanceof Error ? err.message : String(err),
            );
        }
    }
}

// ---------------------------------------------------------------------------
// HTML rendering
// ---------------------------------------------------------------------------

function renderDecisionHtml(
    webview: vscode.Webview,
    decision: DecisionOut,
    reviews: ReviewOut[],
    timeline: EventOut[],
): string {
    const csp = [
        "default-src 'none'",
        "style-src 'unsafe-inline'",
        `img-src ${webview.cspSource} https: data:`,
    ].join("; ");

    const summary = decision.summary ? renderMarkdown(decision.summary) : `<p class="empty">No summary.</p>`;
    const rationale = decision.rationale ? renderMarkdown(decision.rationale) : `<p class="empty">No rationale recorded.</p>`;
    const reviewsBlock = renderReviews(reviews);
    const timelineBlock = renderTimeline(timeline);

    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <style>${STYLES}</style>
</head>
<body>
    <h1>${escapeHtml(decision.display_id)} — ${escapeHtml(decision.title)}</h1>
    <p class="meta">
        <span class="badge status-${escapeAttr(decision.status)}">${escapeHtml(decision.status)}</span>
        <span class="badge">risk: ${escapeHtml(decision.risk_level)}</span>
        ${decision.human_approval_required ? `<span class="badge">human approval</span>` : ""}
        <span class="ts">created ${escapeHtml(decision.created_at.slice(0, 19).replace("T", " "))}</span>
    </p>

    <h2>Summary</h2>
    ${summary}

    <h2>Rationale</h2>
    ${rationale}

    <h2>Reviews (${reviews.length})</h2>
    ${reviewsBlock}

    <h2>Timeline (${timeline.length})</h2>
    ${timelineBlock}
</body>
</html>`;
}

function renderErrorHtml(webview: vscode.Webview, message: string): string {
    const csp = `default-src 'none'; style-src 'unsafe-inline'; img-src ${webview.cspSource} https:;`;
    return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>${STYLES}</style></head><body>
    <h1>Could not load decision</h1>
    <p class="empty">${escapeHtml(message)}</p>
    </body></html>`;
}

function renderReviews(reviews: ReviewOut[]): string {
    if (reviews.length === 0) {
        return `<p class="empty">No reviews yet.</p>`;
    }
    const rows = reviews
        .map((r) => {
            const findings = r.findings
                .map(
                    (f) => `<tr>
                <td><span class="severity-${escapeAttr(f.severity)}">${escapeHtml(f.severity)}</span></td>
                <td>${escapeHtml(f.category)}</td>
                <td>${escapeHtml(f.file_path ?? "—")}${f.line_start ? `:${f.line_start}${f.line_end && f.line_end !== f.line_start ? `-${f.line_end}` : ""}` : ""}</td>
                <td>${escapeHtml(f.message)}${f.recommendation ? `<br><span class="reco">→ ${escapeHtml(f.recommendation)}</span>` : ""}</td>
            </tr>`,
                )
                .join("");
            const findingsBlock = r.findings.length
                ? `<table class="findings"><thead><tr><th>Severity</th><th>Category</th><th>Location</th><th>Message</th></tr></thead><tbody>${findings}</tbody></table>`
                : `<p class="empty">No findings on this review.</p>`;
            const summaryHtml = r.summary ? renderMarkdown(r.summary) : "";
            return `<div class="review">
                <div class="review-head">
                    <strong>${escapeHtml(r.display_id)}</strong>
                    <span class="badge status-${escapeAttr(r.status)}">${escapeHtml(r.status)}</span>
                    <span class="ts">${escapeHtml(r.created_at.slice(0, 19).replace("T", " "))}</span>
                </div>
                ${summaryHtml}
                ${findingsBlock}
            </div>`;
        })
        .join("");
    return rows;
}

function renderTimeline(events: EventOut[]): string {
    if (events.length === 0) {
        return `<p class="empty">No events yet.</p>`;
    }
    const rows = events
        .map(
            (e) => `<tr>
            <td class="ts">${escapeHtml(e.created_at.slice(0, 19).replace("T", " "))}</td>
            <td><code>${escapeHtml(e.event_type)}</code></td>
        </tr>`,
        )
        .join("");
    return `<table class="timeline"><tbody>${rows}</tbody></table>`;
}

function renderMarkdown(md: string): string {
    // marked v14: parse is sync when no async extensions are registered.
    // We don't allow raw HTML in markdown — marked escapes it by default
    // since v5. Trust the backend (the user's own data) but stay defensive.
    return marked.parse(md, { async: false, gfm: true, breaks: true }) as string;
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
    return s.replace(/[^a-zA-Z0-9_-]/g, "_");
}

const STYLES = `
body {
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    padding: 1.5rem 2rem 3rem;
    max-width: 980px;
    margin: 0 auto;
    line-height: 1.5;
}
h1 { font-size: 1.4em; margin: 0 0 0.4em; font-weight: 600; }
h2 {
    font-size: 1.05em;
    margin: 2.2em 0 0.6em;
    padding-bottom: 0.3em;
    border-bottom: 1px solid var(--vscode-panel-border);
    font-weight: 600;
    color: var(--vscode-descriptionForeground);
    text-transform: uppercase;
    letter-spacing: 0.04em;
}
p { margin: 0.5em 0; }
.meta { font-size: 0.9em; margin-bottom: 0.5em; }
.badge {
    display: inline-block;
    padding: 0.12em 0.55em;
    margin-right: 0.4em;
    border-radius: 0.3em;
    font-size: 0.8em;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    font-weight: 500;
}
.badge.status-approved { background: rgba(46, 160, 67, 0.4); }
.badge.status-rejected { background: rgba(248, 81, 73, 0.4); }
.badge.status-changes_requested { background: rgba(217, 152, 55, 0.4); }
.badge.status-review_required { background: rgba(56, 139, 253, 0.4); }
.badge.status-draft { background: var(--vscode-editorWidget-background); }
.badge.status-commented { background: rgba(125, 125, 125, 0.4); }
.ts { color: var(--vscode-descriptionForeground); font-family: var(--vscode-editor-font-family); font-size: 0.85em; }
.empty { color: var(--vscode-descriptionForeground); font-style: italic; }
table { width: 100%; border-collapse: collapse; margin-top: 0.5em; }
th, td {
    padding: 0.45em 0.6em;
    text-align: left;
    border-bottom: 1px solid var(--vscode-panel-border);
    vertical-align: top;
    font-size: 0.92em;
}
th { font-weight: 600; color: var(--vscode-descriptionForeground); }
table.findings td:nth-child(3) { font-family: var(--vscode-editor-font-family); font-size: 0.85em; }
table.timeline td:first-child { width: 11em; }
code {
    font-family: var(--vscode-editor-font-family);
    background: var(--vscode-textCodeBlock-background);
    padding: 0.1em 0.35em;
    border-radius: 0.2em;
    font-size: 0.9em;
}
.severity-critical { color: #ff5555; font-weight: 700; }
.severity-high { color: #ff8c00; font-weight: 600; }
.severity-medium { color: #f0ad4e; }
.severity-low { color: var(--vscode-descriptionForeground); }
.severity-info { color: var(--vscode-descriptionForeground); font-style: italic; }
.reco { color: var(--vscode-descriptionForeground); font-size: 0.9em; }
.review { margin: 1em 0 1.6em; }
.review-head { margin-bottom: 0.4em; }
.review-head strong { margin-right: 0.6em; }
blockquote {
    margin: 0.5em 0;
    padding: 0 0 0 1em;
    border-left: 3px solid var(--vscode-panel-border);
    color: var(--vscode-descriptionForeground);
}
pre, pre code {
    background: var(--vscode-textCodeBlock-background);
    padding: 0.6em 0.8em;
    border-radius: 0.3em;
    overflow-x: auto;
}
`;
