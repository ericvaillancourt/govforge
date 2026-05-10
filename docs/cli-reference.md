# `gf` CLI Reference

Complete reference for every `gf` subcommand. Source of truth: the cobra
trees in
[`cli/internal/commands/`](../cli/internal/commands/) and the embedded
help text. Run `gf <command> --help` for the canonical wording.

## Global flags

Every command accepts these:

| Flag           | Default                | Description                                                          |
|----------------|------------------------|----------------------------------------------------------------------|
| `--api-url`    | `http://127.0.0.1:8787`| Override the local HTTP API URL.                                     |
| `--config`     | autodetect             | Path to a `config.toml` (overrides project autodetection).           |
| `--json`       | off                    | Emit JSON instead of human-readable tables.                          |
| `--no-color`   | off                    | Disable ANSI styling. Auto-disabled when `NO_COLOR` is set.          |

## Exit codes

| Code | Meaning                                                            |
|------|--------------------------------------------------------------------|
| `0`  | Success                                                            |
| `1`  | User error (missing flag, no `.govforge/` found, validation)       |
| `2`  | Backend error (API returned 4xx/5xx)                               |
| `3`  | Network error (connection refused, timeout, DNS)                   |

## Environment variables

| Var                       | Effect                                                       |
|---------------------------|--------------------------------------------------------------|
| `GOVFORGE_DB`             | Path or SQLAlchemy URL for the database.                     |
| `GOVFORGE_API_URL`        | Overrides `api_url` from config (Viper auto-binding).        |
| `GOVFORGE_API_HOST`       | Bind host for `gf api serve` (default `127.0.0.1`).          |
| `GOVFORGE_API_PORT`       | Bind port for `gf api serve` (default `8787`).               |
| `NO_COLOR`                | Disable ANSI styling (POSIX convention).                     |

---

## `gf init [path]`

Bootstrap a project's `.govforge/` directory. Autonomous — no backend
required. Embeds the SQL schema via `go:embed` and applies it through
`modernc.org/sqlite` (pure-Go, no cgo).

| Flag           | Description                                              |
|----------------|----------------------------------------------------------|
| `--name`       | Project name (defaults to the directory name)            |
| `--force`      | Overwrite an existing `.govforge/` directory             |

Creates:

- `.govforge/config.toml` — `api_url`, project name, default branch
- `.govforge/policies.toml` — five enabled defaults
- `.govforge/govforge.db` — SQLite database with all 12 tables

```bash
gf init                          # in the current repo
gf init ~/code/myrepo            # explicit path
gf init --name "Govern Demo"     # override the inferred project name
```

---

## `gf project`

### `gf project status`

Report the project root, DB path, API URL, and `/health` reachability.

```bash
gf project status
gf project status --json
```

### `gf project config`

Print the resolved configuration (file + env + flags merged).

```bash
gf project config
```

---

## `gf task`

### `gf task create`

| Flag             | Description                                                 |
|------------------|-------------------------------------------------------------|
| `--title`        | Task title **(required)**                                   |
| `--description`  | Task description                                            |
| `--risk`         | Risk level: `low` / `medium` (default) / `high` / `critical`|
| `--actor`        | Agent creating the task (e.g. `claude`, `codex`, `eric`)    |

```bash
gf task create --title "Refactor auth" --risk high --actor claude
```

### `gf task list`

| Flag         | Description                                          |
|--------------|------------------------------------------------------|
| `--status`   | Filter: `open`, `in_progress`, `review_required`, …  |

### `gf task show TASK-NNN`

Show one task with its description, risk, and status.

```bash
gf task show TASK-001
```

---

## `gf decision`

### `gf decision create`

| Flag                | Description                                              |
|---------------------|----------------------------------------------------------|
| `--task`            | Task display ID **(required)**                           |
| `--author`          | Author agent name **(required)**                         |
| `--title`           | Decision title **(required)**                            |
| `--summary`         | One-paragraph summary                                    |
| `--rationale`       | Why this decision over alternatives                      |
| `--risk`            | Risk level (default `medium`)                            |
| `--human-approval`  | Require explicit human approval                          |

```bash
gf decision create \
  --task TASK-001 \
  --author claude \
  --title "Migrate to signed cookies" \
  --summary "Replace session lookup with signed cookies" \
  --rationale "Reduce DB roundtrips and simplify middleware" \
  --risk high
```

### `gf decision list [--status]`

### `gf decision show DEC-NNN`

### `gf decision timeline DEC-NNN`

Render the append-only event log for a decision (`decision.created`,
`decision.git_attached`, `decision.policy_evaluated`, `review.requested`,
`review.submitted`, `decision.status_changed`, `decision.approved`, …).

```bash
gf decision timeline DEC-001
```

---

## `gf git`

### `gf git attach`

| Flag            | Description                                          |
|-----------------|------------------------------------------------------|
| `--decision`    | Decision display ID **(required)**                   |
| `--commit`      | Commit ref (default `HEAD`)                          |
| `--actor`       | Acting agent                                         |

Runs the read-only Git extractor (`core.git`) against the project's
working tree and persists a `GitChange` row + emits the
`decision.git_attached` event. **Never** writes to Git.

```bash
gf git attach --decision DEC-001 --commit HEAD --actor claude
```

### `gf git diff`

Show the metadata of the latest GitChange attached to a decision.
Phase 1 doesn't expose the raw diff text — see
[`docs/architecture.md`](architecture.md) for the trade-off.

---

## `gf policy`

### `gf policy list`

List the registered policies (default 5; custom ones from
`.govforge/policies.toml` are merged in on first run).

### `gf policy check --decision DEC-NNN`

Evaluate every active policy against the decision's latest GitChange.
Persists `PolicyResult` rows + emits `decision.policy_evaluated`. If
any result is `blocked`, bumps the decision from `draft` to
`review_required`.

```bash
gf policy check --decision DEC-001
```

---

## `gf review`

### `gf review request`

| Flag           | Description                                             |
|----------------|---------------------------------------------------------|
| `--decision`   | Decision display ID **(required)**                      |
| `--reviewer`   | Reviewer agent name **(required)**                      |
| `--focus`      | Comma-separated focus list (e.g. `security,tests`)      |

Marks a decision as `review_required` and emits `review.requested` for
the reviewer to pick up.

### `gf review list [--open]`

`--open` filters to reviews on decisions still in `review_required`.

### `gf review show REV-NNN`

Show a review with its findings (severity, category, file, message,
recommendation).

> **Submitting** a structured review is intentionally **not** a CLI
> command — agents do this through the MCP `submit_review` tool.
> Humans submitting findings by hand belong in the cockpit UI.

---

## `gf approve` / `gf reject`

```bash
gf approve DEC-001 --comment "OK after rotation patch"
gf reject  DEC-001 --comment "Migration looks unsafe"
```

| Flag           | Description                              |
|----------------|------------------------------------------|
| `--approver`   | Approver agent name (default `eric`)     |
| `--comment`    | Approval comment                         |

`approve` sets the decision to `approved` and emits
`decision.approved`. `reject` sets it to `rejected` and emits
`decision.rejected`. Both are final states — a follow-up needs a new
decision.

---

## `gf mcp serve` / `gf api serve` / `gf ui serve`

Thin spawners for the long-running components. Each inherits stdio so
logs go straight to the terminal.

### `gf mcp serve`

Spawns `python -m govforge.mcp.server` with `GOVFORGE_DB` set to the
project's database. Stdio transport — agents pick up the tools.

### `gf api serve`

| Flag       | Default     | Description       |
|------------|-------------|-------------------|
| `--host`   | `127.0.0.1` | Bind host         |
| `--port`   | `8787`      | Bind port         |

Spawns `python -m govforge.api.server`. The CLI itself talks to this.

### `gf ui serve`

Spawns `npx next start` in the `ui/` directory at the project root.
Phase 1 expects a checked-out copy of the GovForge repo nearby; Phase 3
will package the cockpit as a static binary.

---

## `gf version`

Prints the CLI version (set at build time via
`-ldflags "-X main.Version=v0.1.0"`) plus the backend version reported
by `/health` if reachable.

```bash
gf version
gf version --json
```

```text
gf
cli: 0.1.0
backend: 0.1.0 (ok)
```

---

## Command map (one line each)

```text
gf init [path] [--name --force]
gf project status
gf project config
gf task create --title --risk --description --actor
gf task list [--status]
gf task show TASK-NNN
gf decision create --task --author --title --summary --rationale --risk --human-approval
gf decision list [--status]
gf decision show DEC-NNN
gf decision timeline DEC-NNN
gf git attach --decision --commit --actor
gf git diff --decision
gf policy list
gf policy check --decision
gf review request --decision --reviewer --focus
gf review list [--open]
gf review show REV-NNN
gf approve DEC-NNN [--approver --comment]
gf reject DEC-NNN [--approver --comment]
gf mcp serve
gf api serve [--host --port]
gf ui serve
gf version
```
