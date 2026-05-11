<div align="center">

<img src="brand/wordmark.svg" alt="GovForge" width="280" />

**Govern AI coding agents before they govern your codebase.**

[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)
[![Backend CI](https://github.com/ericvaillancourt/govforge/actions/workflows/backend.yml/badge.svg)](https://github.com/ericvaillancourt/govforge/actions/workflows/backend.yml)
[![CLI CI](https://github.com/ericvaillancourt/govforge/actions/workflows/cli.yml/badge.svg)](https://github.com/ericvaillancourt/govforge/actions/workflows/cli.yml)
[![UI CI](https://github.com/ericvaillancourt/govforge/actions/workflows/ui.yml/badge.svg)](https://github.com/ericvaillancourt/govforge/actions/workflows/ui.yml)
[![Python](https://img.shields.io/badge/python-3.12+-3776ab)](backend/pyproject.toml)
[![Go](https://img.shields.io/badge/go-1.22+-00add8)](cli/go.mod)
[![MCP-native](https://img.shields.io/badge/MCP-native-7c3aed)](docs/mcp-integration.md)

[Website](https://govforge.dev) · [Docs](https://docs.govforge.dev) · [MCP integration](https://docs.govforge.dev/mcp-integration) · [Workflow example](https://docs.govforge.dev/workflow-example) · [Threat model](https://docs.govforge.dev/threat-model) · [API](https://api.govforge.dev/docs)

</div>

---

## What is GovForge?

GovForge is a **local-first governance layer** that sits between AI coding
agents (Claude Code, Codex, Cursor, Cline, Aider, …) and your repository.
It captures every code-shaping decision an agent makes — the rationale,
the diff, the policy results, peer-agent reviews, and the human approval —
into an append-only, queryable audit log. No SaaS, no telemetry, no
network egress: the entire stack runs on the developer's machine.

## Why

- **Agent code is invisible by default.** A few tokens turn into a
  migration script or an auth refactor. The repo only sees the diff;
  the *why* and the *risk* vanish.
- **Two-agent workflows compound the problem.** When Claude proposes
  and Codex reviews, the disagreement that mattered most is gone the
  moment the IDE tab closes.
- **Approval has to be explicit.** "I read the diff" isn't a record.
  GovForge records the human gate as a first-class entity, alongside
  policy results and structured findings.

## Quickstart

```bash
# 1. Install (binary releases coming Phase 2 — for now build from source):
git clone https://github.com/ericvaillancourt/govforge
cd govforge/cli && go build -o ~/bin/gf ./cmd/gf
cd ../backend && pip install -e .

# 2. Initialize a project:
cd ~/your/repo
gf init

# 3. Start the local API + cockpit:
gf api serve &
cd ~/govforge/ui && npm ci && npm run dev   # http://localhost:8788

# 4. (Self-hosted only) Bootstrap your first admin token — see infra/RUNBOOK.md §8.
#    The hosted API at api.govforge.dev requires Authorization: Bearer <token>
#    on every write; local `gf` against your own backend goes through the same
#    code path but the bootstrap is automatic in `gf init`.

# 5. Walk a decision through the pipeline:
gf task create --title "Refactor auth" --risk high --actor claude
gf decision create --task TASK-001 --author claude --title "Migrate to signed cookies" --risk high
gf git attach --decision DEC-001 --commit HEAD
gf policy check --decision DEC-001
gf review request --decision DEC-001 --reviewer codex
gf approve DEC-001 --comment "OK after rotation patch"

# 6. Audit:
gf decision timeline DEC-001
```

The full Claude → Codex → human-approval walkthrough lives in
[`docs/workflow-example.md`](docs/workflow-example.md).

## Install

| Platform        | Method                                         | Status                        |
|-----------------|------------------------------------------------|-------------------------------|
| Source (any OS) | `git clone` + `go build` + `pip install -e .` | ✅ today                      |
| Homebrew tap    | `brew install ericvaillancourt/tap/govforge`   | 🚧 Phase 2 release pipeline   |
| `pipx`          | `pipx install govforge`                        | 🚧 Phase 2 (PyPI)             |
| Pre-built binary| GoReleaser (linux/darwin/windows × amd64/arm64)| 🚧 Phase 2 (first tag)        |

## How it works

```
agents (Claude / Codex / Cursor / Cline / Aider)
    │   stdio
    ▼
FastMCP server  ──┐
                  │
gf CLI ──HTTP─▶  FastAPI (127.0.0.1:8787)  ──▶  Services  ──▶  Models / SQLite
                  │                                │  │
UI cockpit ───────┘                                │  └──▶  Event store (audit log)
                                                   │
                                                   ├─▶  Git extractor (read-only)
                                                   └─▶  Policy engine (5 defaults)
```

Three components on the developer's machine: the Python backend (services
+ MCP + HTTP API), the Go CLI `gf`, and the Next.js cockpit at
`localhost:8788`. Full architecture in
[`docs/architecture.md`](docs/architecture.md), data model in
[`docs/data-model.md`](docs/data-model.md).

## MCP integration

Drop GovForge into Claude Code by adding a server entry to
`~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "govforge": {
      "command": "python",
      "args": ["-m", "govforge.mcp.server"],
      "env": {
        "GOVFORGE_DB": "/absolute/path/to/.govforge/govforge.db"
      }
    }
  }
}
```

Codex / Cursor / Cline configs in
[`docs/mcp-integration.md`](docs/mcp-integration.md).

The agent gets **11 tools**, **5 resources**, and **3 prompts** —
schemas in
[`backend/src/govforge/mcp/schemas.py`](backend/src/govforge/mcp/schemas.py).

## Built-in policies

Five defaults ship with `gf init`. Override via `.govforge/policies.toml`.

| Policy                              | Trigger                                                          |
|-------------------------------------|------------------------------------------------------------------|
| `auth_change_requires_review`       | a file path matches `auth`, `session`, `jwt`, `permission`, `middleware` → BLOCKED |
| `secret_pattern_detection`          | diff content matches `AWS_SECRET_ACCESS_KEY`, `PRIVATE_KEY`, etc. → BLOCKED; `.env`-style filenames → WARNING |
| `test_required_for_high_risk`       | risk ≥ HIGH but no test file in the diff → WARNING               |
| `migration_requires_review`         | path matches `migrations/` or `alembic/versions/` → BLOCKED      |
| `large_diff_requires_human_approval`| insertions + deletions exceed threshold (default 500) → BLOCKED  |

Adding a policy is one Python class — see
[`backend/src/govforge/core/policies/defaults.py`](backend/src/govforge/core/policies/defaults.py).

## Repository layout (monorepo)

| Folder | Role | Status |
|---|---|---|
| [`backend/`](./backend/) | Python: FastMCP + FastAPI + SQLAlchemy services | ✅ feature-complete (97 tests, 90 % coverage) |
| [`cli/`](./cli/) | Go: `gf` binary | ✅ feature-complete (75–100 % per package) |
| [`ui/`](./ui/) | Next.js: local cockpit (`gf ui serve`) | ✅ feature-complete |
| [`brand/`](./brand/) | Brand assets (SVG wordmark + marks) | ✅ |
| [`docs/`](./docs/) | Architecture, data model, MCP integration, threat model, workflow | ✅ |
| [`infra/`](./infra/) | Caddy + Podman quadlet + sudoers | ✅ deployed |
| [`.github/workflows/`](./.github/workflows/) | CI: backend / cli / ui / release | ✅ |

> The **marketing site** at <https://govforge.dev> lives in a separate
> private repo so brand and copy can iterate without OSS ceremony. The
> product (this repo) stays Apache 2.0.

## Documentation

- [Architecture](https://docs.govforge.dev/architecture) — components + sequence diagram + audit-log invariant
- [Data model](https://docs.govforge.dev/data-model) — 14 entities (incl. User + ApiToken) + ER diagram + state machine
- [MCP integration](https://docs.govforge.dev/mcp-integration) — Claude Code / Codex / Cursor / Cline wiring
- [Threat model](https://docs.govforge.dev/threat-model) — security guarantees pinned by tests
- [Workflow example](https://docs.govforge.dev/workflow-example) — full Claude → Codex → human-approval walkthrough
- [API auth runbook](infra/RUNBOOK.md#85-stage-b-live-since-2026-05-10-05-11) — operator-side recipe for the Stage B env vars + signed-in UX (GitHub + Google OAuth)
- [Brand guide](https://docs.govforge.dev/brand) — assets, palette, tagline, tone of voice
- [CHANGELOG](CHANGELOG.md)

## Contributing

Contributions welcome — see
[`CONTRIBUTING.md`](CONTRIBUTING.md). For security issues, follow the
private disclosure process in [`SECURITY.md`](SECURITY.md). All
participants are bound by the
[Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).

## License

[Apache License 2.0](LICENSE) — see [`LICENSE`](LICENSE) and
[`NOTICE`](NOTICE).

Copyright 2026 Eric Vaillancourt and GovForge contributors.
