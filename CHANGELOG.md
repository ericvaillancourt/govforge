# Changelog

All notable changes to GovForge are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

The first release will be `0.1.0` and will mark Phase 1 feature-complete.
Everything below is on `main` but unreleased.

### Added — Backend (Python)

- Domain layer
  - `core.enums` — 9 stable `StrEnum` types (`RiskLevel`, `DecisionStatus`,
    `ReviewStatus`, `FindingSeverity`, `FindingCategory`, `PolicyResultStatus`,
    `ApprovalStatus`, `TaskStatus`, `AgentType`).
  - `core.ids` — display-id helpers (`TASK-001`, `DEC-001`, `REV-001`, …).
  - `core.models` — 12 SQLAlchemy 2 entities with `Mapped[…]` typing,
    cascade-delete trees, append-only `events` table.
- Read-only Git extractor (`core.git`)
  - `extract_commit`, `list_changed_files`, `count_changes`, `get_diff_text`,
    `compute_diff_hash` (sha256), `assert_path_in_repo` (symlink-aware).
  - Allowlisted Git verbs only: `diff`, `show`, `log`, `rev_parse`,
    `ls_tree`, `rev_list`, `cat_file`. No write-side Git operations.
- Policy engine (`core.policies`)
  - `Policy` ABC with `PolicyContext` + `PolicyVerdict`.
  - 5 default policies: `auth_change_requires_review`,
    `secret_pattern_detection`, `test_required_for_high_risk`,
    `migration_requires_review`, `large_diff_requires_human_approval`.
  - TOML loader for `.govforge/policies.toml` with sane defaults if absent.
  - Pure runner (no DB / Git side-effects).
- Service layer (`core.services`)
  - `ProjectService`, `TaskService`, `DecisionService`, `ReviewService`,
    `PolicyService`, `DisagreementService`, `ApprovalService`,
    `TimelineService`, `EventService`.
  - Every mutating method emits an `Event` row → audit log complete by
    construction.
- FastMCP server (`mcp`)
  - 11 tools (`create_task`, `record_decision`, `attach_git_diff`,
    `run_policy_checks`, `request_review`, `submit_review`,
    `record_disagreement`, `approve_decision`, `get_decision_context`,
    `list_open_reviews`, `list_pending_approvals`).
  - 5 resources (`govforge://project/{id}/policies`,
    `govforge://decision/{id}`, `govforge://task/{id}/timeline`,
    `govforge://review/{id}`, `govforge://project/{id}/conventions`).
  - 3 prompt templates (`review_code_decision`, `explain_disagreement`,
    `summarize_decision`).
  - Stdio transport. Entry point: `python -m govforge.mcp.server`.
- HTTP API (`api`)
  - FastAPI app on `127.0.0.1:8787` with CORS allowed to localhost UI ports.
  - All routes from `devis.md §17`: projects, tasks, decisions (+ timeline,
    attach-git, approve, reject), reviews (request, submit, list, get),
    policies (list, check), events (filter by project or entity).
  - OpenAPI auto-served at `/docs` + `/openapi.json`.
  - Entry point: `python -m govforge.api.server`.

### Added — CLI (Go)

- Single static binary `gf`, cross-compiled for linux/darwin/windows × amd64/arm64.
- Cobra commands: `init`, `project status/config`, `task create/list/show`,
  `decision create/list/show/timeline`, `git attach/diff`, `policy list/check`,
  `review request/list/show`, `approve`, `reject`, `mcp serve`, `api serve`,
  `ui serve`, `version`.
- `gf init` is autonomous — embeds the SQL schema (`go:embed`), default
  `policies.toml`, and `config.toml` template; uses `modernc.org/sqlite`
  (pure-Go) so no cgo is needed.
- Global flags: `--api-url`, `--config`, `--json`, `--no-color`.
- Exit codes 0/1/2/3 for success / user-error / backend-error / network-error.
- Renderer: tables via `go-pretty`, colours via `lipgloss`, JSON-mode via
  the global `--json` flag.

### Added — UI cockpit (Next.js 16)

- Local cockpit on `127.0.0.1:8788`. Reads from the FastAPI HTTP API.
- Pages: Dashboard (`/`), Tasks (`/tasks`, `/tasks/[id]`), Decisions
  (`/decisions`, `/decisions/[id]`), Reviews (`/reviews`, `/reviews/[id]`).
- Components: `Nav`, `ProjectSwitcher` (localStorage-backed),
  `StatusBadge`, `Timeline` (vertical event list with `lucide-react` icons),
  `ApprovalActions` (Approve / Reject + comment, with TanStack Query
  cache invalidation).
- Phase 1 trade-off: line-by-line diff viewer deferred — backend doesn't
  expose raw diff text yet. Decision Detail shows the Git change panel
  (commit + branch + files + insertions/deletions).

### Added — Marketing site

- Public site live at `https://govforge.dev`. Bilingual EN/FR via Next.js
  App Router `[lang]/` segment + server-only JSON dictionaries
  (`src/dictionaries/{en,fr}.json`). Root `/` is a static
  redirect that sniffs `navigator.language`. Language toggle in the nav
  preserves the current path across locales. Hreflang `en`/`fr`/`x-default`
  + `OpenGraph.locale` `en_US ↔ fr_CA`.
- Public docs site rendered from `docs/*.md` at build time
  (`marked` + `@tailwindcss/typography`). 13 markdown files × 2 locales
  = 26 static pages under `[lang]/docs/[slug]`. Sidebar groups docs by
  section; "View on GitHub" / "Edit this page" links per page; FR pages
  show a banner that French translation is pending.
- Markdown link rewriter normalises sibling `foo.md` → `../foo/` and
  cross-package `../site/x` / `../backend/x` → GitHub blob URLs at build
  time, so doc cross-references keep working on the live site.
- `docs.govforge.dev` is wired in Caddy as a 301 alias of
  `govforge.dev/en/docs/*` (no separate docs container — the marketing
  site IS the docs site).
- Footer "API" link points to the live FastAPI Swagger UI at
  `api.govforge.dev/docs` (auto-generated from the OpenAPI spec).
- Stack: Next.js 16 + Tailwind v4 + shadcn/ui Base UI.
- Static export; deployed via Caddy + Podman quadlet on a self-hosted
  hypervisor, fronted by an existing Cloudflare tunnel (no Vercel
  dependency).

### Added — Infrastructure

- Self-hosted Podman 4.9 on `192.168.2.5`, rootless, with `Restart=always`,
  `loginctl enable-linger`, `podman-auto-update.timer` for automatic
  registry pulls.
- firewalld rich rule (LAN-only) gating `:8080` to the existing tunnel host.
- NOPASSWD sudoers for the deploy host limited to the exact commands
  needed for ops (no broad sudo).

### Added — Tests

- Backend: 97 tests, **90% coverage**.
  - Service layer: per-service unit tests + workflow tests.
  - Policy engine: per-policy unit tests + loader + runner.
  - MCP server: in-process `Client` integration tests over the full
    Claude → Codex → approval workflow.
  - HTTP API: TestClient over file-backed SQLite, 13 tests.
  - Integration: `tests/integration/test_pipeline.py` walks the canonical
    workflow with real components (real Git repo, real DB).
  - Security: source-grep attestations for "no shell-out", "no eval/exec",
    "Git extractor read-only", "path traversal refused", "no shell-style
    tool name".
- CLI: 75–100% coverage per package (target 70%).
  - `client/`: 75% — every method shape (POST/GET/path/query) tested
    against `httptest.Server`.
  - `commands/`: 76% — cobra `Execute()` against fake API, exit codes,
    JSON output, no-config error.
  - `config/`: 79% — file load + env override + `FindProjectRoot` walk-up.
  - `embed/`: 100%.
  - `render/`: 88%.
  - Race detector clean.

### Added — CI / CD

- GitHub Actions workflows:
  - `backend.yml` — ruff format + lint + mypy strict + pytest with coverage.
  - `cli.yml` — Go 1.25 + vet + build + golangci-lint + `go test -race -cover`.
  - `ui.yml` — `npm ci` + type-check + ESLint + `next build`.
  - `release.yml` — GoReleaser on tag (cross-compile + Homebrew tap).

### Added — Documentation

- Per-package README (backend, cli, ui).
- `docs/architecture.md` — software architecture (layers, components,
  sequence diagram).
- `docs/data-model.md` — 12 entities + relationships + enum values + ER diagram.
- `docs/mcp-integration.md` — wiring guides for Claude Code, Codex,
  Cursor, Cline.
- `docs/threat-model.md` — security guarantees with pointers to the tests
  pinning each one.
- `docs/workflow-example.md` — full Claude → Codex → human-approval
  walkthrough using real `gf` commands.

### Project metadata

- License: Apache 2.0 (`LICENSE` + `NOTICE`).
- Public repo: `https://github.com/ericvaillancourt/govforge`.
- Domain: `govforge.dev`.

---

[Unreleased]: https://github.com/ericvaillancourt/govforge/commits/main
