# GovForge CLI — `gf`

The GovForge developer CLI. A single Go binary that:

- initializes a repo for governance (`gf init`) — autonomous, no backend needed
- creates tasks, decisions, attaches Git diffs, runs policies, requests reviews, approves / rejects
- spawns the Python backend (`gf mcp serve`, `gf api serve`) and the UI cockpit (`gf ui serve`)

## Stack

- Go 1.22+ (tested on 1.25; CI uses 1.25)
- [cobra](https://github.com/spf13/cobra) — commands & subcommands
- [viper](https://github.com/spf13/viper) — config (`.govforge/config.toml`, env, flags)
- [lipgloss](https://github.com/charmbracelet/lipgloss) — colours
- [go-pretty](https://github.com/jedib0t/go-pretty) — Rich-like tables
- [resty](https://github.com/go-resty/resty) — HTTP client to local backend
- [`modernc.org/sqlite`](https://gitlab.com/cznic/sqlite) — pure-Go SQLite driver (no cgo)
- `go:embed` — bakes the SQL schema, default policies, and config template into the binary so `gf init` works without the backend

## Quick start

```bash
cd cli
go build -o gf ./cmd/gf

# Initialize a project and start the backend:
./gf init                        # creates .govforge/ with config + policies + DB
./gf api serve &                 # spawns python -m govforge.api.server
./gf project status              # check API + DB

# Walk a decision through the pipeline:
./gf task create --title "Refactor auth" --risk high --actor claude
./gf decision create --task TASK-001 --author claude --title "Migrate to signed cookies" --risk high
./gf git attach --decision DEC-001 --commit HEAD
./gf policy check --decision DEC-001
./gf review request --decision DEC-001 --reviewer codex
./gf approve DEC-001 --comment "OK after rotation patch"
./gf decision timeline DEC-001
```

See [`../docs/workflow-example.md`](../docs/workflow-example.md) for the full
Claude → Codex → human-approval walkthrough.

## Global flags

| Flag           | What it does                                                         |
|----------------|----------------------------------------------------------------------|
| `--api-url`    | Override the local API URL (default `http://127.0.0.1:8787`)         |
| `--config`     | Override config-file path (default: `.govforge/config.toml` walked-up)|
| `--json`       | Emit JSON instead of human-readable tables                           |
| `--no-color`   | Disable ANSI styling (auto-disabled when `NO_COLOR` is set)          |

## Exit codes

| Code | Meaning                                                            |
|------|--------------------------------------------------------------------|
| 0    | Success                                                            |
| 1    | User error (missing flag, no `.govforge/` found, validation failure)|
| 2    | Backend error (API returned 4xx/5xx)                               |
| 3    | Network error (connection refused, timeout, DNS)                   |

## Cross-compile

```bash
GOOS=linux   GOARCH=amd64 go build -o dist/gf-linux-amd64       ./cmd/gf
GOOS=linux   GOARCH=arm64 go build -o dist/gf-linux-arm64       ./cmd/gf
GOOS=darwin  GOARCH=amd64 go build -o dist/gf-darwin-amd64      ./cmd/gf
GOOS=darwin  GOARCH=arm64 go build -o dist/gf-darwin-arm64      ./cmd/gf
GOOS=windows GOARCH=amd64 go build -o dist/gf-windows-amd64.exe ./cmd/gf
```

CI automates this via `goreleaser` (see [`.goreleaser.yaml`](.goreleaser.yaml)
and [`.github/workflows/release.yml`](../.github/workflows/release.yml)).

## Layout

```
cli/
├── go.mod
├── .goreleaser.yaml
├── cmd/gf/main.go             # entry point (calls commands.Execute)
└── internal/
    ├── client/                # typed HTTP client + APIError + Time wrapper
    ├── commands/              # one file per resource (task / decision / …)
    ├── config/                # Viper loader + project-root walk-up
    ├── render/                # tables (go-pretty) + colours (lipgloss)
    └── embed/                 # schema.sql + policies.toml + config.toml template
```

## Tests

| Package                | Coverage |
|------------------------|----------|
| `internal/client`      | 75%      |
| `internal/commands`    | 76%      |
| `internal/config`      | 79%      |
| `internal/embed`       | 100%     |
| `internal/render`      | 88%      |

```bash
go test -race -cover ./...
```

Command tests use `cobra.Execute()` against an `httptest.Server` to assert
exit codes, JSON output, and table rendering without any real backend.

## License

Apache 2.0 — see [`../LICENSE`](../LICENSE).
