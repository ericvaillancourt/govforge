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

### Added — Review, approval and disagreement actions (Phase 4) (2026-05-12)

Five new commands. The plugin now drives the **full** author →
reviewer → approver workflow without leaving VS Code.

- **GovForge: Request Review** — right-click any Decision (or palette
  → pick). Prompts for reviewer agent name + optional focus areas
  (comma-separated). `POST /reviews/request` flips the decision to
  REVIEW_REQUIRED.
- **GovForge: Submit Review** — right-click an open Review row in
  the Reviews tree (or palette → pick decision). Multi-step prompt:
  reviewer agent (defaults to `govforge.agent`), verdict
  (approved / changes_requested / commented / rejected), optional
  summary, then a findings loop ("Add a finding" / "Submit now").
  Each finding prompts severity, category, message, optional
  file_path, optional line range (N or N-M), optional recommendation.
  `POST /reviews` with the findings array.
- **GovForge: Approve Decision** / **Reject Decision** — right-click
  a Decision (or palette → pick). Prompts for an optional comment,
  then a modal confirmation ("This is a final state — a follow-up
  needs a new decision."), then `POST /decisions/{id}/approve` or
  `/reject`. A 403 surfaces a hint that the token needs
  `approvals:write` scope (Stage C A follow-up — `decisions:write`
  alone no longer covers approve/reject on the HTTP API).
- **GovForge: Record Disagreement** — right-click a Decision (or
  palette → pick). Prompts for topic (required), author position,
  reviewer position, risk summary, and whether the disagreement
  needs a human tiebreaker. `POST /disagreements`.

Context menu layout per Decision row:

  1_actions  : attach git, run policy
  2_review   : request review, record disagreement
  3_approve  : approve, reject

Each group is separated by a divider so destructive verbs sit
visually apart from day-to-day actions.

Tree items now expose `ReviewOut` on `ReviewItem` so right-click
handlers can identify the decision behind the review.

Bundle: 107 KB → 121 KB. .vsix: 57 KB → 67 KB gzipped.

### Added — Inline findings annotations (Phase 5) (2026-05-12)

Review findings now surface as **native VS Code diagnostics** —
squigglies in the editor, entries in the Problems panel
(`Cmd/Ctrl+Shift+M`) under source `GovForge`, hover with the review
id, category, message and recommendation.

- Severity mapping: `critical` and `high` → Error (red), `medium` →
  Warning (yellow), `low` → Information, `info` → Hint. Maps to the
  standard `vscode.DiagnosticSeverity` so themes and color filters
  work out of the box.
- Diagnostic `code` is `REV-NNN/category` so the Problems panel
  groups by review and clicking jumps to the file:line that the
  reviewer pointed at.
- Path resolution: `Finding.file_path` is relative to
  `Project.root_path`, but that path may be from another machine
  (very common on the hosted backend). The annotator tries the
  project root first, then every open workspace folder root. Files
  that don't exist on this machine are silently skipped — no noise.
- Refreshed via the existing `refreshAll` pipeline, so any author
  action that creates a new review (Submit Review) or changes
  project (Switch Project) updates the diagnostics automatically.

This is the most differentiating feature of the plugin: the reviewer
agent's findings show up RIGHT WHERE THE PROBLEM LIVES, while you're
editing the code. Closes the loop from review back to the editor
without a context switch.

Bundle: 121 KB → 124 KB. .vsix: 67 KB → 70 KB gzipped.

### Changed — Per-backend token storage + smarter backend switch (2026-05-12)

Tokens are now stored **per backend URL** in SecretStorage
(`govforge.apiToken:${baseUrl}`) instead of a single global key. The
practical wins:

- Switching `govforge.apiUrl` between local and hosted reuses the
  right token automatically. No more retyping after every flip.
- A 401 against one backend doesn't poison the credential for the
  other.
- `GovForge: Sign Out` only signs out from the **current** backend;
  the other one's token stays intact.

Backend-switch UX also smarter:

- `GovForge: Switch Backend` checks whether the new backend already
  has a stored token. If yes → toast "Existing token reused". If no
  → toast offers "Sign in now" / "Later" and runs the sign-in flow
  on confirmation.
- The `govforge.signedIn` context key now resyncs on every apiUrl
  change so the welcome view (with the Sign In button) is shown
  immediately when you land on a backend you've never signed into.

Migration: any pre-Phase-6 token under the old global
`govforge.apiToken` key is moved into the per-URL slot the first
time it's read, then the legacy key is deleted. Existing users are
not asked to sign in again.

Bundle: 124 KB → 125 KB. .vsix: 70 KB → 72 KB gzipped.

### Added — React webview infrastructure + Submit Review form (Phase A of v0.2 UI rewrite) (2026-05-12)

The "wizard at the top of the screen" UX with QuickPick chains is
gone for the worst offender — **Submit Review now opens a real form
in a panel beside the editor**. All fields visible at once, dynamic
findings list with [+ Add finding] / [× Remove], inline validation,
submit button, theme-aware via `--vscode-*` CSS variables.

**Infrastructure** (reusable for Phases B/C/D):

- `vscode/src/forms/messages.ts` — discriminated unions for the
  extension ↔ webview message bus. Type-safe on both sides, all
  five planned forms declared (only `submitReview` implemented
  this phase).
- `vscode/src/forms/form-panel.ts` — `FormPanelHost`. Spawns a
  `WebviewPanel` in `ViewColumn.Beside`, injects options via
  `window.__GF_FORM__`, listens for one `submit` / `cancel`, calls
  the right `GovForgeClient` method, posts `submitDone` /
  `submitError` back, closes after 900 ms on success and triggers
  `refreshAll()`.
- `vscode/tsconfig.webview.json` — separate tsconfig for the
  webview bundle (browser target, JSX, DOM lib).
- `npm run bundle:webview` — esbuild → minified IIFE bundle
  (`out/webview.js`, 144 KB) + CSS sibling (`out/webview.css`,
  4 KB). Includes `process.env.NODE_ENV='"production"'` define so
  React tree-shakes its dev warnings.

**Webview React tree** (`vscode/webview/`):

- `index.tsx` — entry, reads `window.__GF_FORM__.form` to route.
- `api.ts` — wraps `acquireVsCodeApi()` + typed `postToExtension` /
  `onExtensionMessage`.
- `styles.css` — VS Code CSS-variable based, banners (success /
  error), finding-row card layout, spinner animation, primary /
  secondary buttons.
- `components/Field.tsx`, `Select.tsx`, `Button.tsx` — generic
  primitives.
- `components/FindingRow.tsx` — one finding card with severity /
  category selects, file_path, line_start / line_end, message,
  recommendation, and a `×` remove button.
- `forms/SubmitReviewForm.tsx` — reviewer input, verdict select,
  summary textarea, dynamic findings list, Submit / Cancel. State
  machine: idle → submitting → done / error.

**Wiring**:

- `commands/reviews.ts::submitReview` no longer does a 4–6 step
  prompt chain. It resolves the target decision (right-click or
  pick) then opens the form panel with `formPanels.openForm({
  form: "submitReview", decisionId, decisionTitle, ... })`.
- `commands/reviews.ts::requestReview` stays as a 2-step prompt
  for now (Phase C will convert it).

**Bundle**: extension 127 KB (unchanged), webview 144 KB minified,
CSS 4 KB. `.vsix` total **131 KB** (was 72 KB — +59 KB for React).

Phases B/C/D will add the four other forms (Create Task, Record
Decision, Request Review, Record Disagreement) on top of this
infra at low marginal cost.

### Added — CreateTaskForm + RecordDecisionForm (v0.2 Phase B) (2026-05-12)

Two more wizard-chains converted to React webview forms.

- **CreateTaskForm** — title input (autofocus, required), risk_level
  select (medium pre-picked), description textarea (markdown OK,
  optional). Replaces a 3-step prompt chain.
- **RecordDecisionForm** — read-only header "under TASK-NNN — title"
  to show context, title input, summary textarea, rationale
  textarea, risk_level select, human_approval_required checkbox.
  Replaces a 5-step prompt chain that was the most painful.

Both forms inherit the Phase A infrastructure (Field / Select /
Button components, state machine idle → submitting → done / error,
banner + spinner, auto-close on success). The
`commands/tasks.ts::createTask` and `commands/decisions.ts::recordDecision`
handlers now resolve the project / task and just call
`formPanels.openForm({...})` — every line of prompt-chain logic
removed.

`attachGitDiff` and `runPolicyChecks` stay native — single-prompt or
prompt-less, the form panel would be overkill.

Bundle: webview 144 KB → 148 KB (+4 KB for the two new forms).
`.vsix`: 131 KB → 134 KB.
