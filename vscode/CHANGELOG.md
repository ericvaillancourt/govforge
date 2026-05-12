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
