# GovForge CLI — `gf`

The GovForge developer CLI. A single Go binary that:

- Initializes a repo for governance (`gf init`) — autonomous, no backend needed
- Creates tasks, decisions, attaches diffs, runs policies, requests reviews, approves
- Spawns the Python backend (MCP server / HTTP API) and the UI cockpit when needed

## Stack

- Go 1.22+
- [cobra](https://github.com/spf13/cobra) — commands
- [viper](https://github.com/spf13/viper) — config (`.govforge/config.toml`, env, flags)
- [lipgloss](https://github.com/charmbracelet/lipgloss) — colors / TUI
- [go-pretty](https://github.com/jedib0t/go-pretty) — Rich-like tables
- [resty](https://github.com/go-resty/resty) — HTTP client to local backend
- `go:embed` — bakes the SQL schema into the binary so `gf init` works without the backend

## Build

```bash
cd cli
go build -o gf ./cmd/gf
./gf version
./gf help
```

## Cross-compile

```bash
GOOS=linux   GOARCH=amd64 go build -o dist/gf-linux-amd64 ./cmd/gf
GOOS=linux   GOARCH=arm64 go build -o dist/gf-linux-arm64 ./cmd/gf
GOOS=darwin  GOARCH=amd64 go build -o dist/gf-darwin-amd64 ./cmd/gf
GOOS=darwin  GOARCH=arm64 go build -o dist/gf-darwin-arm64 ./cmd/gf
GOOS=windows GOARCH=amd64 go build -o dist/gf-windows-amd64.exe ./cmd/gf
```

In CI, this is automated by `goreleaser` via `.goreleaser.yaml` (see `.github/workflows/release.yml`).

## Layout

```
cli/
├── go.mod
├── cmd/gf/main.go        # entry point
└── internal/
    ├── client/           # HTTP client to backend API
    ├── commands/         # cobra commands
    ├── config/           # viper config loader
    ├── render/           # tables, colors
    └── embed/            # schema.sql embedded for `gf init`
```

## License

Apache 2.0 — see [`../LICENSE`](../LICENSE).
