# MCP Integration Guide

How to connect Claude Code, Codex, Cursor, Cline, Aider — or any other
[Model Context Protocol](https://modelcontextprotocol.io/) client — to a
local GovForge backend.

## TL;DR

```bash
# 1. Initialize a project
cd ~/your/repo
gf init

# 2. Point the agent at the GovForge stdio server. The exact config file
#    differs per agent; the launcher command is always the same:
#
#        python -m govforge.mcp.server
#
#    with environment variable GOVFORGE_DB pointing at the project's DB.
```

The MCP server is **stdio-only** in Phase 1. Each agent spawns its own
copy as a subprocess.

## What the agent gets

Once connected, the agent sees:

- **11 tools** (callable functions): `create_task`, `record_decision`,
  `attach_git_diff`, `run_policy_checks`, `request_review`, `submit_review`,
  `record_disagreement`, `approve_decision`, `get_decision_context`,
  `list_open_reviews`, `list_pending_approvals`.
- **5 resources** (read-only context handles):
  - `govforge://project/{project_id}/policies`
  - `govforge://decision/{decision_id}`
  - `govforge://task/{task_id}/timeline`
  - `govforge://review/{review_id}`
  - `govforge://project/{project_id}/conventions`
- **3 prompts** (template helpers): `review_code_decision`,
  `explain_disagreement`, `summarize_decision`.

Tool input/output schemas mirror `devis.md §10.2` and are documented in
`backend/src/govforge/mcp/schemas.py`.

## Wiring per agent

### Claude Code

Edit `~/.claude/mcp.json` (or the project-local equivalent):

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

Restart Claude Code. The 11 tools appear under the `govforge` namespace.

### Codex

Codex's `~/.codex/config.toml` (or repo-local equivalent):

```toml
[[mcp_servers]]
name = "govforge"
command = "python"
args = ["-m", "govforge.mcp.server"]

[mcp_servers.env]
GOVFORGE_DB = "/absolute/path/to/.govforge/govforge.db"
```

### Cursor

Cursor reads `~/.cursor/mcp.json` (and project-local `.cursor/mcp.json`):

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

### Cline / Aider / other

Any MCP-compliant client takes a `command` + `args` pair. Use the same
Python module entry; pass `GOVFORGE_DB` in the env.

## Tool reference

Quick reference. Full Pydantic schemas live in `backend/src/govforge/mcp/schemas.py`.

### Mutation tools

| Tool                    | Effect                                                                     |
|-------------------------|----------------------------------------------------------------------------|
| `create_task`           | Adds a Task on the project at `project_path`. Returns `TASK-NNN`.         |
| `record_decision`       | Adds a Decision under a Task. Returns `DEC-NNN`.                          |
| `attach_git_diff`       | Runs the read-only Git extractor against `repo_path` + `commit_hash`. Persists a GitChange. |
| `run_policy_checks`     | Evaluates active policies. If any → `BLOCKED`, decision moves to `REVIEW_REQUIRED`. |
| `request_review`        | Marks a decision as `REVIEW_REQUIRED` and tags a reviewer agent.          |
| `submit_review`         | Persists a Review with structured findings. `CHANGES_REQUESTED` / `REJECTED` cascade to the decision. |
| `record_disagreement`   | First-class structured disagreement; can be flagged `requires_human_decision`. |
| `approve_decision`      | Final human gate. Sets decision to `APPROVED` / `REJECTED` / `CHANGES_REQUESTED`. |

### Read tools

| Tool                     | Returns                                                                   |
|--------------------------|---------------------------------------------------------------------------|
| `get_decision_context`   | The full bundle: decision + git change + reviews + policy results + disagreements + approvals + timeline events. |
| `list_open_reviews`      | Reviews on decisions still in `REVIEW_REQUIRED`.                          |
| `list_pending_approvals` | Decisions awaiting human approval (`human_approval_required = true`).     |

### Important conventions

- Identifiers at the boundary are **display IDs** (`TASK-001`, `DEC-001`,
  `REV-001`), not UUIDs. The agent never has to know the UUID.
- Agent names are free-form strings — `claude`, `codex`, `cursor`, or
  `eric`. The server auto-creates an `Agent` row on first use; the type
  is inferred from the name (`claude` → `CLAUDE`, `eric` → `HUMAN`, …).
- Tools are **non-destructive**. A failed call rolls back its DB session;
  no half-written rows.
- Policies are **idempotent**. Re-running `run_policy_checks` produces a
  new set of `PolicyResult` rows; old ones aren't deleted.

## Prompts

Use the prompts when you want the agent to produce structured output.
Each prompt takes a single `decision_id` argument (and `focus` for review).

```text
review_code_decision(decision_id, focus="security,tests,architecture")
explain_disagreement(decision_id)
summarize_decision(decision_id)
```

The full template text is in `backend/src/govforge/mcp/prompts.py` — the
`review_code_decision` prompt explicitly asks for `severity` / `category`
/ `file_path` / `line_range` / `message` / `recommendation`, which lines
up with the `submit_review` finding schema.

## Troubleshooting

### Agent says "tools not available"

Check the MCP server can launch:

```bash
GOVFORGE_DB=/path/to/.govforge/govforge.db python -m govforge.mcp.server <<< ''
# Should print nothing and exit on EOF (stdio idle).
```

If you see `ModuleNotFoundError: No module named 'govforge'`, install the
backend in the env the agent uses to spawn Python:

```bash
cd /path/to/govforge/backend
pip install -e .
```

### Agent calls `attach_git_diff` and gets `not a git repository`

`repo_path` must be the **absolute path** to a Git working tree. The
extractor refuses paths that escape the repo root after symlink resolution
(security guarantee — see [`threat-model.md`](threat-model.md)).

### "Decision not found: DEC-NNN"

Display IDs are project-scoped. Make sure the agent is operating on the
right project. `list_pending_approvals` is a quick way to see what's
visible.

### CHANGES_REQUESTED on a review didn't move the decision

It does — but only on `CHANGES_REQUESTED` and `REJECTED`. `APPROVED` and
`COMMENTED` reviews **don't** auto-approve the decision; a human approval
via `approve_decision` is required. This is by design — see
[`threat-model.md`](threat-model.md).
