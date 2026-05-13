import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { GovForgeClient } from "./api/client";
import type { FindingOut, ReviewOut } from "./api/types";
import type { ProjectSelection } from "./project-selection";
import { resolveActiveProject } from "./workspace";

/**
 * Surfaces review findings as native VS Code diagnostics so they appear:
 *
 *   - inline as squigglies in the editor on the `file_path`/`line_range`
 *     each finding cites,
 *   - in the Problems panel (Ctrl/Cmd+Shift+M) under source = "GovForge",
 *   - on hover with the review id, category, message and recommendation.
 *
 * Diagnostics is the right API for "the code has a problem the user
 * should know about". Decorations would also work but live outside the
 * Problems flow and don't compose with the Quick Fix ecosystem.
 *
 * Path resolution: findings store paths relative to `Project.root_path`,
 * which may be a path from another machine (very common on the hosted
 * backend). We try `Project.root_path` first, then walk through
 * `workspace.workspaceFolders` looking for an existing file. Findings
 * that resolve to nothing on this machine are simply skipped.
 */
export class FindingsAnnotator implements vscode.Disposable {
    private readonly diagnostics: vscode.DiagnosticCollection;

    constructor(
        private readonly client: GovForgeClient,
        private readonly selection: ProjectSelection,
    ) {
        this.diagnostics = vscode.languages.createDiagnosticCollection("govforge");
    }

    dispose(): void {
        this.diagnostics.dispose();
    }

    async refresh(): Promise<void> {
        this.diagnostics.clear();
        const project = await resolveActiveProject(this.client, this.selection);
        if (!project) return;

        let reviews: ReviewOut[];
        try {
            reviews = await this.client.listReviews(project.root_path);
        } catch {
            return;
        }

        const byFile = new Map<string, vscode.Diagnostic[]>();
        const candidateRoots = [
            project.root_path,
            ...(vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath),
        ];

        for (const review of reviews) {
            for (const finding of review.findings) {
                if (!finding.file_path || finding.line_start == null) continue;
                const absPath = resolveExisting(candidateRoots, finding.file_path);
                if (!absPath) continue;

                const diag = buildDiagnostic(finding, review);
                const key = absPath;
                const list = byFile.get(key) ?? [];
                list.push(diag);
                byFile.set(key, list);
            }
        }

        for (const [absPath, diags] of byFile) {
            this.diagnostics.set(vscode.Uri.file(absPath), diags);
        }
    }
}

function resolveExisting(roots: string[], relPath: string): string | undefined {
    for (const root of roots) {
        const candidate = path.isAbsolute(relPath)
            ? relPath
            : path.join(root, relPath);
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return undefined;
}

function buildDiagnostic(finding: FindingOut, review: ReviewOut): vscode.Diagnostic {
    // The backend stores line numbers 1-based and inclusive on both ends.
    // VS Code Range is 0-based with the end exclusive in character terms,
    // but for whole-line markers we just pick a wide column range.
    const lineStart = Math.max(0, (finding.line_start ?? 1) - 1);
    const lineEnd = Math.max(lineStart, (finding.line_end ?? finding.line_start ?? 1) - 1);
    const range = new vscode.Range(lineStart, 0, lineEnd, Number.MAX_SAFE_INTEGER);

    const parts = [finding.message];
    if (finding.recommendation) {
        parts.push("", `→ ${finding.recommendation}`);
    }
    const diag = new vscode.Diagnostic(range, parts.join("\n"), severityFor(finding.severity));
    diag.source = "GovForge";
    diag.code = `${review.display_id}/${finding.category}`;
    return diag;
}

function severityFor(severity: FindingOut["severity"]): vscode.DiagnosticSeverity {
    switch (severity) {
        case "critical":
        case "high":
            return vscode.DiagnosticSeverity.Error;
        case "medium":
            return vscode.DiagnosticSeverity.Warning;
        case "low":
            return vscode.DiagnosticSeverity.Information;
        case "info":
        default:
            return vscode.DiagnosticSeverity.Hint;
    }
}
