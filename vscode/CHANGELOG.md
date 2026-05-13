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

### Added — Author actions (Phase 3) (2026-05-12)

Four new commands. Each works two ways — from the command palette
(prompts to pick the target entity) or from a right-click on the
relevant tree item (target inferred).

- **GovForge: Create Task** — palette + `$(add)` icon button on the
  Tasks view title bar. Prompts for title, risk_level (low / medium
  / high / critical, medium pre-picked), optional description. Posts
  to `POST /tasks` on the active project.
- **GovForge: Record Decision** — right-click any Task in the tree
  (or palette → pick task). Prompts for title, optional summary,
  optional rationale, risk_level, "human approval required" (yes/no).
  Posts to `POST /decisions` linking the decision to that task.
- **GovForge: Attach Git Diff** — right-click any Decision in the
  tree (or palette → pick decision). Prompts for repo_path (defaults
  to the active project's `root_path`) and commit_hash (defaults to
  `HEAD`). Posts to `POST /decisions/{id}/attach-git`; the backend's
  Git extractor reads the repo on the server side.
- **GovForge: Run Policy Checks** — right-click any Decision (or
  palette → pick). Posts to `POST /policies/check` for the decision
  and surfaces the verdict in a notification: info toast when all
  policies pass, warning toast with the blocked count when one
  flips the decision to REVIEW_REQUIRED.

New setting `govforge.agent` (default: OS username) — name credited
on every author action. Set to `claude`, `codex`, etc. to drive the
plugin from an automation script.

Tree items now expose the underlying `TaskOut` / `DecisionOut` via
public readonly fields so command handlers can read them on
right-click without an extra fetch. Bundle: 97 KB → 107 KB.
