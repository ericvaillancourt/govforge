<div align="center">

<img src="brand/wordmark.svg" alt="GovForge" width="280" />

**Govern AI coding agents before they govern your codebase.**

[![Release](https://img.shields.io/github/v/release/ericvaillancourt/govforge?label=release)](https://github.com/ericvaillancourt/govforge/releases/latest)
[![PyPI](https://img.shields.io/pypi/v/govforge?label=pypi)](https://pypi.org/project/govforge/)
[![npm](https://img.shields.io/npm/v/@govforge/cli?label=%40govforge%2Fcli)](https://www.npmjs.com/package/@govforge/cli)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)
[![Backend CI](https://github.com/ericvaillancourt/govforge/actions/workflows/backend.yml/badge.svg)](https://github.com/ericvaillancourt/govforge/actions/workflows/backend.yml)
[![CLI CI](https://github.com/ericvaillancourt/govforge/actions/workflows/cli.yml/badge.svg)](https://github.com/ericvaillancourt/govforge/actions/workflows/cli.yml)
[![UI CI](https://github.com/ericvaillancourt/govforge/actions/workflows/ui.yml/badge.svg)](https://github.com/ericvaillancourt/govforge/actions/workflows/ui.yml)
[![Python](https://img.shields.io/badge/python-3.12+-3776ab)](backend/pyproject.toml)
[![Go](https://img.shields.io/badge/go-1.25+-00add8)](cli/go.mod)
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

Common setup, then pick the entry point that fits how you work — typing
in a terminal (**CLI**) or chatting with your AI assistant (**Agent**).

```bash
# Install once
git clone https://github.com/ericvaillancourt/govforge
cd govforge/cli && go build -o ~/bin/gf ./cmd/gf
cd ../backend && pip install -e .

# In any repo you want governed
cd ~/your/repo
gf init                              # creates .govforge/
gf api serve --port 8787 &           # local API
(cd <govforge-clone>/ui && npm ci && npm run dev)   # http://localhost:8788
```

> Self-hosted only: bootstrap your first admin token via
> [`infra/RUNBOOK.md`](infra/RUNBOOK.md) §8. The hosted API at
> `api.govforge.dev` requires `Authorization: Bearer <token>` on every
> write; local `gf` against your own backend goes through the same
> code path but the bootstrap is automatic in `gf init`.

### CLI

Walk a decision through the pipeline by typing commands:

```bash
gf task create --title "Refactor auth" --risk high --actor claude
gf decision create --task TASK-001 --author claude \
  --title "Migrate to signed cookies" --risk high
gf git attach --decision DEC-001 --commit HEAD
gf policy check --decision DEC-001
gf review request --decision DEC-001 --reviewer codex
gf review submit DEC-001 --reviewer codex --status approved   # or via cockpit / MCP
gf approve DEC-001 --comment "OK after rotation patch"
gf decision timeline DEC-001
```

The full Claude → Codex → human-approval walkthrough lives in
[`docs/workflow-example.md`](docs/workflow-example.md).

### Agent

Don't want to learn the CLI? Drive the same flow by chatting with the
agents you already use. Mint a scoped token per agent:

```bash
gf token create --label claude-author  --agent claude \
  --scopes tasks:write,decisions:write,reviews:write,decisions:read,reviews:read
gf token create --label codex-reviewer --agent codex \
  --scopes reviews:write,reviews:read,decisions:read
```

Paste each `gfp_…` into the matching agent's MCP config — exact
snippets per client (Claude Code, Codex, Cursor, Cline) in
[`docs/mcp-integration.md`](docs/mcp-integration.md). Then chat:

> **You** (in Claude Code): *"Refactor session auth to signed cookies.
> Flag it as high-risk in GovForge before you start."*
>
> **Claude**: *opens `TASK-001`, edits the code, records `DEC-001`,
> attaches the diff, runs the policy checks, and requests a review
> from Codex — all in the background.*
>
> **You** (switching to Codex): *"Review `DEC-001` in GovForge. Focus
> on session security."*
>
> **Codex**: *reads the diff and submits a structured review with
> findings.*

When the decision is ready, approve it at
<http://localhost:8788/decisions/DEC-001>. The agent tokens never
carry `approvals:write` — by design, the final signature stays a
human action.

Full vibe-coder walkthrough:
[`docs/workflow-example-agents.md`](docs/workflow-example-agents.md).

## Install

Pick whichever fits your stack — every channel ships the same `v0.1.0` `gf` binary, all signed with cosign.

| Platform                        | Method                                                                       | Status   |
|---------------------------------|------------------------------------------------------------------------------|----------|
| Pre-built binary (curl one-liner) | `curl -fsSL https://govforge.dev/install.sh \| sh`                          | ✅ today |
| Homebrew tap (macOS / Linux)    | `brew install ericvaillancourt/tap/govforge`                                 | ✅ today |
| `pipx` / `pip` (backend wheel)  | `pipx install govforge` *(or `pip install govforge` for the FastMCP server + HTTP API)* | ✅ today |
| `npx` wrapper (no Go/Python)    | `npx -y @govforge/cli@latest --version` *(postinstall downloads the signed `gf` binary)* | ✅ today |
| Docker (backend container)      | `docker pull ghcr.io/ericvaillancourt/govforge-backend:v0.1.0`               | ✅ today |
| Source (any OS)                 | `git clone` + `go build` + `pip install -e .`                                | ✅ today |

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
