# Changelog — `govforge` VS Code extension

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added — v0.1.0 scaffold (2026-05-12)

Phase 1 of the VS Code cockpit plan: read-only sidebar, auth, status bar.

- Activity bar container "GovForge" with three tree views:
  - **Tasks** — every task on the workspace's project, with status + risk
  - **Decisions** — every decision, with status + risk
  - **Reviews** — every review with finding count
- Welcome view on each tree until the user signs in.
- **GovForge: Sign In** command — `gfp_` token paste, stored in VS Code's
  `SecretStorage` (never on disk in plain text).
- **GovForge: Sign Out** command — clears the secret.
- **GovForge: Refresh** command — re-fetch all three trees and the status bar.
- Left-side status bar item: `$(shield) my-repo · 3 tasks · 2 dec · 1 review open`.
- Workspace → project resolution via `GET /projects` matched on `root_path`
  against `vscode.workspace.workspaceFolders`.
- `govforge.apiUrl` setting (default `http://127.0.0.1:8787`); live-reloads
  the trees + status bar when changed.
- 401 on any read after sign-in re-prompts for a fresh token.
- **Backend chooser** — `GovForge: Switch Backend` command (palette +
  welcome view + dedicated right-status-bar item showing
  `$(plug) GovForge: local` / `$(globe) GovForge: hosted`). QuickPick
  with three options: Local (`http://127.0.0.1:8787`), Hosted
  (`https://api.govforge.dev`), or Custom URL. When a workspace is
  open, a second QuickPick asks whether to apply Globally (User
  Settings) or to this workspace only — same scoping vocabulary as
  every other VS Code setting.
- **Project picker** — `GovForge: Switch Project` command (palette,
  view title bar `$(folder)` icon, status bar click target,
  welcome view button when signed in but no project resolves).
  QuickPick lists every project on the current backend with name +
  `root_path`. Picked project is stored in workspace state (per-repo
  stickiness) and wins over the previous folder-path auto-detection.
  Solves the common case where `Project.root_path` was captured on a
  different machine than the one you're now on — the trees were
  empty with no clear way out.

### Added — Decision detail webview (Phase 2) (2026-05-12)

Click any decision in the sidebar tree → a panel opens with:

- **Header** : `DEC-NNN — Title`, status badge (themed per status),
  risk badge, "human approval" badge if applicable, and created-at.
- **Summary** + **Rationale** rendered as Markdown (gfm + soft line
  breaks) via `marked` v14. Raw HTML in the markdown is escaped by
  default so trust boundaries stay intact.
- **Reviews** section — one block per review with status badge,
  optional summary (also markdown), and a findings table with
  severity (color-coded), category, file path + line range, message
  and recommendation.
- **Timeline** — every event recorded for the decision, in order.

Styling uses VS Code's CSS variables (`--vscode-foreground`,
`--vscode-badge-background`, `--vscode-panel-border`, etc.) so the
panel matches whatever theme is active. CSP is locked to
`default-src 'none'; style-src 'unsafe-inline'; img-src cspSource https:;`
— no scripts in v0.1.

Re-opening the same decision focuses the existing panel instead of
spawning duplicates. `retainContextWhenHidden: true` keeps state when
switching away. Phase 3+ will swap `enableScripts: false` for `true`
and add action buttons that post-back to the extension host.

Bundle size: 97 KB (was 22 KB) — marked adds ~75 KB. Total `.vsix`
49 KB gzipped.
