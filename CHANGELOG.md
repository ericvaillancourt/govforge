# Changelog

All notable changes to GovForge are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

The first release will be `0.1.0` and will mark Phase 1 feature-complete.
Everything below is on `main` but unreleased.

### Fixed — Cockpit auth gap closed (2026-05-11)

> Discovered during the same-day E2E test : opening
> `http://localhost:8788/decisions/DEC-001` in a browser returned
> Internal Server Error because the cockpit's `fetch()` wrapper sent
> no `Authorization` header, but Phase 3.0 Stage A (live 2026-05-10)
> requires Bearer auth on every route.

- `ui/src/lib/api.ts` — `request()` now reads the token from
  `localStorage` (via `lib/token.ts`) and injects `Authorization:
  Bearer <token>` when present.
- New `ui/src/lib/token.ts` — small storage helper
  (`getToken`/`setToken`/`clearToken`) backed by `localStorage` key
  `govforge.token`, with a `govforge:token-changed` event so the
  `TokenGate` re-renders when the token changes from elsewhere.
- New `ui/src/components/TokenGate.tsx` — header widget rendered in
  `Nav.tsx`. Two states : (1) no token → input + Sign in button,
  (2) token present → masked prefix + Sign out. On sign in/out it
  invalidates every React Query cache so the cockpit refetches with
  fresh auth.
- New `ui/src/app/api/local-auth/route.ts` — Next.js server route
  that reads `~/.config/govforge/auth.toml` (the same file written
  by `gf auth login`) and returns the token to the client on boot.
  Local-first auto-sign-in : if the operator has already signed in
  via the CLI, the cockpit picks up the same token automatically,
  no manual paste required. A `sessionStorage` flag suppresses the
  auto-feed for the rest of the tab after an explicit Sign out so
  the gesture sticks until refresh.
- Self-hosted threat model : single-user / single-machine, token in
  `localStorage` is reachable only by same-origin scripts and the
  cockpit doesn't load 3rd-party code. Threat surface ≈ direct file
  access (`auth.toml` is `chmod 600`). Hosted cockpit
  (`app.govforge.dev`, Phase 3) will replace this path with OAuth
  session cookies which `RequirePrincipal` already accepts.

### Fixed — CI hygiene + legacy-name cleanup (2026-05-11)

> Restoring all three validation pipelines (`backend`, `cli`, `ui`) to
> green after the repo-relocation work. Same-day batch of small infra
> fixes that each unblocked the next.

- **Backend lint**: 24 ruff errors (mostly `RUF100` unused-noqa on a
  rule that isn't enabled, plus `F821` missing `UUID` import in
  `test_api.py`). Auto-fixed 23, added the import.
- **Backend format**: applied `ruff format` to 8 files. The CI runs
  `ruff format --check` after `ruff check` — both must pass.
- **Backend mypy**: 3 `Argument type` errors in `api/auth.py` from the
  two-`Session` shadowing (`govforge.core.models.Session` vs
  `sqlalchemy.orm.Session`). Annotated DB-session params with the
  pre-existing `DBSession` alias.
- **CLI flaky test**: `TestPolicyCheckCommand` rendered an empty table
  in CI but passed on dev. Root cause: the `router(map[string])` test
  helper matched paths by `HasPrefix` over a Go map, whose iteration
  order is randomised. With `/policies` and `/policies/check` both
  registered, requests to the latter could resolve to the former.
  Sort prefixes longest-first.
- **CLI lint stack**: bumped `golangci/golangci-lint-action@v6 → v8`
  and pinned `version: v2.12.2`. v1.x is built with Go 1.24 and
  refuses `go 1.25.0` go.mod targets. v2.x defaults to stricter
  `errcheck` — fixed 9 unchecked `fmt.Fprint*` / `Close()` sites with
  `_ = ...` to make the intent explicit.
- **CI ergonomics**: added `workflow_dispatch:` to `backend.yml`,
  `cli.yml`, `ui.yml`. Validation pipelines can now be re-run from
  the Actions UI without a dummy commit.
- **AgentMCP rename cleanup**: dropped 7 stale references to the old
  project name across podman quadlets (`Documentation=` URLs now
  point to the canonical GitHub blob), README quickstart, and the
  `govforge-site` docs resolver fallback path.

### Added — Schema migrations via Alembic (live 2026-05-11)

> Closes the gap that surfaced during Stage B activation when
> `users.avatar_url` had to be added with a manual `ALTER TABLE` on prod.
> Future schema changes ship as Alembic revisions packaged in the wheel.

- `backend/alembic.ini` + `backend/src/govforge/db/migrations/env.py` —
  config + env. DB URL resolves from `GOVFORGE_DATABASE_URL` (alias
  `GOVFORGE_DB`), matching the API runtime exactly. `render_as_batch`
  on so SQLite can do `ALTER TABLE` in future migrations.
- Baseline revision `21c163745df5` capturing the 2026-05-11 schema
  (16 domain tables incl. `users.avatar_url`).
- Follow-up revision `aa2ce082f322` adding `device_codes` (for the
  new device-code flow below).
- `python -m govforge.scripts.migrate` — self-contained wrapper that
  finds the migration tree via `importlib.resources` so it works
  identically from a checkout and inside the prod wheel. Subcommands:
  upgrade, downgrade, stamp, current, history, heads, check.
- `tests/unit/test_alembic.py` — 4 guard tests, including
  `check`-clean-after-upgrade (model-drift detector).
- Onboarding for the live prod DB: `migrate stamp head` (no DDL,
  records the baseline + device_codes revisions as already-applied).
- `GOVFORGE_BOOTSTRAP_SCHEMA=1` removed from prod env — `create_all`
  on boot conflicted with Alembic by pre-creating tables ahead of
  migrations. `create_all` stays for `gf init` local dev and tests.

### Added — `gf auth login --device` (browser approval flow, live 2026-05-11)

> Adds a no-paste authentication path: the CLI prints a short code +
> URL, the user types it on the site after signing in, and the CLI
> auto-receives the issued `gfp_…` token via polling.

- Backend: new `device_codes` table + Alembic migration. Stores
  SHA-256 of the device secret, the human-typable user_code (8 chars,
  ambiguity-free alphabet, displayed `XXXX-YYYY`), requested label +
  agent_type, and the eventual `ApiToken` FK.
- New routes:
  - `POST /auth/device/code` (anon) — issues a fresh code pair, 10 min
    TTL, 5 s poll interval; plaintext `device_code` returned ONCE.
  - `POST /auth/device/poll` (anon) — returns
    `authorization_pending` / `complete` / `expired` / `denied`. On
    `complete`, response includes the plaintext token, consumed
    in-process (second poll returns `denied`).
  - `POST /auth/device/approve` (cookie-authed) — looks up the typed
    code, creates an `ApiToken` for the signed-in user with default
    scopes matching what a coding agent typically needs.
- Frontend: new `/[lang]/device/` page (bilingual EN/FR) with a
  centered input, auto-format `ABCDEFGH` → `ABCD-EFGH` while typing,
  prefill from `?code=…` query string (the CLI links there), redirect
  to `/login/?next=…` if anonymous.
- CLI: `gf auth login --device` (alongside the existing `--token`
  path). Defaults to `cli on <hostname>` label, overridable via
  `--label` / `--agent`. Polls every 5 s up to the 10 min TTL.
- 5 new backend tests (`tests/unit/test_api.py::TestDeviceCode`):
  start, pending → approve → complete, anon approve fails, unknown
  code denied, malformed code 400. Total backend test count is now
  118 (was 113).

### Added — Authentication (Phase 3.0 Stage B — live 2026-05-10/05-11)

> Stage B (OAuth + cookie sessions + browser login) shipped 2026-05-10
> with GitHub. Google OAuth followed same-day (code) and was activated
> 2026-05-11 (Google Cloud Console OAuth client registered, env vars
> deployed). The signed-in UX (avatar dropdown, login/account guards,
> footer entry point) shipped 2026-05-11. Magic link still stubbed.

#### Sign-in UX (live 2026-05-11)

- Nav avatar dropdown (`NavAuth` client component) — fetches
  `/auth/session` on mount and renders one of three states: loading
  skeleton, "Sign in" button, or a 32 px avatar (Google/GitHub photo
  or initials fallback) with a menu listing the user's name + email +
  linked providers, an **Account** link, and **Sign out** (POST
  `/auth/logout`, clears local state regardless of API result).
  Dropdown closes on outside-click or Escape.
- `/[lang]/login/` detects already-signed-in users via
  `/auth/session` on mount. If a session exists, the OAuth buttons
  are replaced by an "already signed in" card with avatar and a link
  to `/account/`. Anonymous visitors see the GitHub + Google buttons
  as before (logic extracted into a `LoginPanel` client component).
- `/[lang]/account/` redirects anonymous visitors to `/login/` via
  `window.location.replace` instead of showing a passive "not signed
  in" message — back-button stays clean.
- Footer `Resources` column adds an `Account` link (bilingual EN/FR).
  Combined with the avatar dropdown and the auto-redirect, every page
  of the site now exposes a path to the auth surface.

#### Google OAuth (live 2026-05-11)

- `/auth/google/{start,callback}` mirrors the GitHub flow:
  authorize at `https://accounts.google.com/o/oauth2/v2/auth` with
  `response_type=code` + `scope=openid email profile` +
  `prompt=select_account`; exchange at
  `https://oauth2.googleapis.com/token`; profile via OpenID userinfo
  `https://www.googleapis.com/oauth2/v3/userinfo`. We explicitly
  require `email_verified=true` from Google.
- `RequirePrincipal(scope=...)` dependency: tokens endpoints
  (`/tokens` POST/GET/DELETE) accept **either** a Bearer token (with
  scope enforcement) **or** a cookie session (scope ignored — the
  logged-in user has implicit access to their own tokens). Fixes a
  401 the browser hit immediately after a successful GitHub sign-in.
- `users.avatar_url` column added (one-time `ALTER TABLE` on the prod
  PostgreSQL — `create_all` only creates missing tables, it doesn't
  migrate existing schemas). This is a pre-Alembic stop-gap.
- Frontend `/[lang]/login/`: Google button is now a live link
  (replaces the previous "coming soon" disabled state). Magic link
  still stubbed.

#### GitHub OAuth (live)

- New domain models: `Account` (one row per linked OAuth provider) and
  `Session` (HMAC-SHA256-signed cookie, 30-day TTL by default). The
  Bearer/`ApiToken` model from Stage A is unchanged — Stage B adds a
  parallel cookie-session path on the same FastAPI app.
- `RequireUser` dependency: resolves `govforge_session` cookie, verifies
  signature, looks up the active `Session` row, returns a
  `UserContext`. Available alongside `RequireToken(scope=...)`.
- `/auth/github/{start,callback}` — full OAuth 2.0 authorization-code
  flow via `httpx` (no Authlib dep). Short-lived `govforge_oauth_state`
  cookie for CSRF protection on the state parameter.
- `/auth/{session,logout}` — return the current user (or `{detail: "No
  active session"}`) and revoke the session row.
- `/auth/magic/request` — wired up but returns `503 Service Unavailable`
  until `RESEND_API_KEY` lands.
- `bin/govforge.api.server`: `uvicorn.run(...)` now passes
  `proxy_headers=True, forwarded_allow_ips="*"` so Starlette honours
  `X-Forwarded-Proto` from Caddy. Without this the GitHub `redirect_uri`
  was emitted as `http://` and rejected by GitHub for not matching the
  registered `https://` callback.
- Frontend `/[lang]/login/`: bilingual EN/FR static page with a
  GitHub button (other providers shown as "coming soon").
- Frontend `/[lang]/account/`: client component fetches `/auth/session`
  + `/tokens` with `credentials: 'include'`, renders profile + tokens
  table + create-token form with scope checkboxes.
- CLI: `gf auth {login,logout,whoami}` and `gf token {create,list,revoke}`.
  Tokens persist to `.govforge/auth.toml` (per-project) or
  `~/.config/govforge/auth.toml` (global). `GOVFORGE_API_TOKEN` env var
  wins over both.
- 16 new auth/oauth tests (`tests/unit/test_api.py::TestOAuth` +
  `TestAuth`): cookie signing roundtrip, anonymous session probe,
  `/auth/{github,google}/start` 302 with state cookie, callback
  rejects bad state for both providers, account+session upsert. Total
  backend test count is now 113, coverage ~75%.

### Added — Authentication (Phase 3.0 Stage A — pulled forward 2026-05-10)

> Pivot trigger: `api.govforge.dev` was discovered exposed publicly with no
> auth (POST /projects returned 201 without any header). Phase 3.0 was
> moved ahead of the public launch (Phase 2.7) to lock the API down.

- New domain models: `User` and `ApiToken`. SHA-256 hashing of the
  bearer secret with prefix-indexed lookup + constant-time compare;
  plaintext is shown to the operator exactly once at creation time and
  is unrecoverable thereafter. Per-token list of `TokenScope` values
  with `admin` super-scope.
- New `TokenScope` enum (14 values): `<resource>:<action>` convention
  covering projects / tasks / decisions / reviews / policies / events /
  tokens (read+write each), plus `admin`.
- `RequireToken(scope=...)` FastAPI dependency factory enforces Bearer
  presence, validity (not revoked / not expired), user is active, and
  scope membership (or `admin`). Stamps `request.state.auth_*` for
  downstream audit logging.
- `/tokens` CRUD endpoints (`POST` / `GET` / `DELETE`) — owner-scoped.
- All existing endpoints declare a per-route scope via FastAPI
  `dependencies=[]`. `/health` stays public for monitoring.
- `python -m govforge.scripts.bootstrap_admin` — one-shot script to
  create the first admin user + token directly in the DB. Breaks the
  chicken-and-egg: the `/tokens` POST itself requires a token.
- 6 new auth tests (`tests/unit/test_api.py::TestAuth`): health open,
  no-auth 401, invalid bearer 401, scoped token creation, scope
  enforcement (403 outside scope), revoked token 401. Total backend
  test count is now 103 (was 97), coverage 88%.

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
