# Workflow Example — Agent-driven (Claude Code + Codex via MCP)

The mirror of [`workflow-example.md`](workflow-example.md), but with the
governance flow **driven by AI agents through MCP** instead of a human
typing CLI commands. Same 13 steps, same end-state — different driver.

Each step lists the **CLI** equivalent (what a human would type) next to
the **MCP** call the agent actually makes against
`govforge.mcp.server`. The three steps that cannot be agent-driven —
project init, backend serve, and final human approval — are kept and
marked as `👤 Human-driven` so the agents-vs-humans split in the chain
of governance is visible at a glance.

Scenario:
**Claude Code proposes a session-auth refactor; Codex reviews and flags
a session-fixation risk; the human approves after reviewing.**

Looking for the human-driven version? See
[`workflow-example.md`](workflow-example.md).

---

## Cast and token scopes

Each agent connects to the same MCP server with its own scoped Bearer
token. Scopes are checked **per tool call** and the MCP server filters
its `tools/list` to only expose tools the token can use, so an agent
that hasn't been granted a scope literally can't see the tool. See
[`mcp-integration.md`](mcp-integration.md) for the wiring details.

| Actor          | Token scopes                                                   | Visible MCP tools                                                                                                  |
|----------------|----------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------|
| **Claude Code** (author)   | `tasks:write`, `decisions:write`, `reviews:write`, `decisions:read`, `reviews:read` | `create_task`, `record_decision`, `attach_git_diff`, `run_policy_checks`, `request_review`, `get_decision_context` |
| **Codex** (reviewer)       | `reviews:write`, `reviews:read`, `decisions:read`                                | `submit_review`, `record_disagreement`, `list_open_reviews`, `get_decision_context`                                |
| **Human** (approver)       | cookie session in the cockpit, or `approvals:write` Bearer token                 | `approve_decision` *(plus everything via the cockpit and `gf` CLI)*                                                |

`approvals:write` is deliberately withheld from agent tokens — the
final signature stays a human action.

---

## Prerequisites

> 👤 **Human-driven setup** — run once per project, then never again.

```bash
# Build the CLI + install the backend (same as the CLI workflow)
cd /path/to/govforge/cli && go build -o ~/bin/gf ./cmd/gf
cd /path/to/govforge/backend && python -m venv .venv && source .venv/bin/activate && pip install -e .
```

---

## Step 0 — Initialize the project

> 👤 **Human-driven step** — no MCP equivalent. Agents work on a
> project that already exists; they don't bootstrap one.

```bash
cd ~/code/myrepo
gf init
```

`gf init` is autonomous: it embeds the schema via `go:embed` and applies
it through the pure-Go `modernc.org/sqlite` driver. No backend needed.

---

## Step 1 — Start the backend and mint agent tokens

> 👤 **Human-driven step** — agents need a running HTTP API and their
> own scoped tokens before they can do anything. This is the one-time
> setup that turns a fresh project into one agents can drive.

```bash
gf api serve --port 8787 &

# One Bearer token per agent, scoped to its role.
gf token create --label claude-author --agent claude \
  --scopes tasks:write,decisions:write,reviews:write,decisions:read,reviews:read

gf token create --label codex-reviewer --agent codex \
  --scopes reviews:write,reviews:read,decisions:read

# Wire each token into the agent's MCP config. See mcp-integration.md for
# the exact JSON snippets per agent (Claude Code, Codex, Cursor, Cline).
```

From here on, **every step below is what the agent emits**, not what a
human types. The CLI column is shown only as a reference for what the
agent's call is equivalent to.

---

## Step 2 — Create a task

Actor: **Claude Code**

**CLI** (human equivalent)
```bash
gf task create \
  --title "Migrate auth session to signed cookies" \
  --risk high \
  --actor claude
```

**MCP** (what Claude Code calls)
```
tool:    create_task
args:    { project_path:  "/home/me/code/myrepo",
           title:         "Migrate auth session to signed cookies",
           risk_level:    "high",
           actor_agent:   "claude" }
returns: { task_id: "TASK-001", status: "open" }
```

---

## Step 3 — Claude implements the change

Actor: **Claude Code** (no MCP call — this is Claude editing files with
its built-in code-edit capability, same as any IDE-assisted change)

```bash
$EDITOR auth.py middleware/session.py tests/test_auth.py
git add -A
git commit -m "refactor(auth): migrate to signed session cookies"
```

The MCP server stays entirely out of the editor loop. Its only Git
contact is **read-only** at step 5.

---

## Step 4 — Record the decision

Actor: **Claude Code**

**CLI** (human equivalent)
```bash
gf decision create \
  --task TASK-001 \
  --author claude \
  --title "Migrate session auth to signed cookies" \
  --summary "Replace server-side session lookup with signed cookie validation" \
  --rationale "Reduce DB roundtrips and simplify middleware" \
  --risk high
```

**MCP** (what Claude Code calls)
```
tool:    record_decision
args:    { task_id:        "TASK-001",
           author_agent:   "claude",
           title:          "Migrate session auth to signed cookies",
           summary:        "Replace server-side session lookup with signed cookie validation",
           rationale:      "Reduce DB roundtrips and simplify middleware",
           risk_level:     "high" }
returns: { decision_id: "DEC-001", status: "draft" }
```

---

## Step 5 — Attach the Git diff

Actor: **Claude Code**

**CLI** (human equivalent)
```bash
gf git attach --decision DEC-001 --commit HEAD --actor claude
```

**MCP** (what Claude Code calls)
```
tool:    attach_git_diff
args:    { decision_id:  "DEC-001",
           repo_path:    "/home/me/code/myrepo",
           commit_hash:  "HEAD",
           actor_agent:  "claude" }
returns: { decision_id:   "DEC-001",
           files_changed: ["auth.py", "middleware/session.py", "tests/test_auth.py"],
           insertions:    84,
           deletions:     31,
           diff_hash:     "sha256:7f9b3..." }
```

The Git extractor walks `commit.diff(parent)` (or `commit.tree.traverse()`
for the initial commit) and stores `commit_hash`, `branch_name`,
`files_changed`, `insertions`, `deletions`, and `sha256:<hex>` of the
unified diff. Read-only — no Git mutation. Paths outside the repo root
are refused (`PathOutsideRepoError`).

---

## Step 6 — Run policy checks

Actor: **Claude Code**

**CLI** (human equivalent)
```bash
gf policy check --decision DEC-001
```

**MCP** (what Claude Code calls)
```
tool:    run_policy_checks
args:    { decision_id: "DEC-001",
           actor_agent: "claude" }
returns: { decision_status: "review_required",
           results: [
             { policy: "auth_change_requires_review",   status: "blocked",
               message: "1 auth-adjacent file(s) modified — review required." },
             { policy: "secret_pattern_detection",      status: "passed",
               message: "No secret patterns detected." },
             { policy: "test_required_for_high_risk",   status: "passed",
               message: "1 test file(s) modified." },
             { policy: "migration_requires_review",     status: "passed",
               message: "No migration files touched." },
             { policy: "large_diff_requires_human_approval", status: "passed",
               message: "Diff size 115 within threshold (500)." }
           ] }
```

Because at least one policy returned `blocked`, `PolicyService` bumped
the decision status to `review_required`. Claude Code sees this in the
returned `decision_status` and decides the next move — typically to
request a review.

---

## Step 7 — Request a review from Codex

Actor: **Claude Code**

**CLI** (human equivalent)
```bash
gf review request \
  --decision DEC-001 \
  --reviewer codex \
  --focus security,tests
```

**MCP** (what Claude Code calls)
```
tool:    request_review
args:    { decision_id:    "DEC-001",
           reviewer_agent: "codex",
           focus:          ["security", "tests"],
           actor_agent:    "claude" }
returns: { decision_id: "DEC-001", status: "review_required" }
```

The `focus` list is metadata for the reviewer — it doesn't gate
anything in the engine, but it appears in the timeline and tells Codex
what Claude expects scrutinized.

---

## Step 8 — Codex submits a review

Actor: **Codex**

Codex is now the active agent. It calls `list_open_reviews` to find work,
then `get_decision_context` to load the diff and rationale, then
`submit_review` with structured findings.

**CLI** (human equivalent, via the v0.1.1 `gf review submit` shortcut)
```bash
gf review submit DEC-001 \
  --reviewer codex \
  --status changes_requested \
  --summary "Session fixation risk" \
  --finding "severity=high;category=security;file_path=middleware/session.py;message=Session token is not rotated after login;recommendation=Rotate session token after successful login"
```

**MCP** (what Codex calls)
```
tool:    submit_review
args:    { decision_id:    "DEC-001",
           reviewer_agent: "codex",
           status:         "changes_requested",
           summary:        "Session fixation risk",
           findings: [
             { severity:       "high",
               category:       "security",
               file_path:      "middleware/session.py",
               message:        "Session token is not rotated after login",
               recommendation: "Rotate session token after successful login" }
           ] }
returns: { review_id:        "REV-001",
           decision_id:      "DEC-001",
           decision_status:  "changes_requested" }
```

The decision moves to `changes_requested`. Review status → decision
status mapping: `changes_requested` → `changes_requested`,
`rejected` → `rejected`, `approved`/`commented` → unchanged (the human
gate at step 11 still applies).

---

## Step 9 — Record a structured disagreement (optional)

Actor: **Codex** *(or Claude, depending on who pushes back)*

When the author and reviewer disagree on a finding, the disagreement is
captured as a first-class entity rather than buried in chat history.

**CLI** (human equivalent, via the v0.1.1 `gf disagreement record` command)
```bash
gf disagreement record DEC-001 \
  --topic "Token rotation timing" \
  --reviewer-position "Rotate before any DB write" \
  --author-position "Rotate after auth succeeds" \
  --risk-summary "Race window between auth and rotation" \
  --requires-human-decision
```

**MCP** (what the agent calls)
```
tool:    record_disagreement
args:    { decision_id:             "DEC-001",
           topic:                   "Token rotation timing",
           reviewer_position:       "Rotate before any DB write",
           author_position:         "Rotate after auth succeeds",
           risk_summary:            "Race window between auth and rotation",
           requires_human_decision: true,
           actor_agent:             "codex" }
returns: { disagreement_id:         "<uuid>",
           decision_id:             "DEC-001",
           requires_human_decision: true }
```

`requires_human_decision: true` adds the decision to the cockpit's
"pending approvals" list — `list_pending_approvals` will surface it,
and the human knows there's a contested call to read before signing.

---

## Step 10 — Patch the code

Actor: **Claude Code**

Claude applies the fix, re-attaches the new commit, and re-runs the
policy checks.

```bash
$EDITOR middleware/session.py   # rotate session token after login
git add -A
git commit -m "fix(auth): rotate session token after login"
```

Then two MCP calls in sequence:

```
tool:    attach_git_diff
args:    { decision_id: "DEC-001",
           repo_path:   "/home/me/code/myrepo",
           commit_hash: "HEAD",
           actor_agent: "claude" }
returns: { decision_id:   "DEC-001",
           files_changed: ["middleware/session.py"],
           insertions:    8,
           deletions:     2,
           diff_hash:     "sha256:3a1c..." }

tool:    run_policy_checks
args:    { decision_id: "DEC-001",
           actor_agent: "claude" }
returns: { decision_status: "review_required",
           results: [ ... ] }
```

Both attachments stay on the same decision; the timeline shows
`decision.git_attached` twice with different `diff_hash` values.

---

## Step 11 — Human approval

> 👤 **Human-driven step** — the only step the agents can't do. Tokens
> issued to Claude Code and Codex don't carry `approvals:write` (Stage C
> rule: the system enforces role, not the prompt).

The human reads the cockpit page for DEC-001 — diff panel, policy
results, the Codex finding, the disagreement, and Claude's patch — then
signs:

```bash
gf approve DEC-001 --comment "Approved after token rotation patch and Codex review"
```

Or clicks **Approve** in the cockpit at
`http://localhost:8788/decisions/DEC-001`. Either path goes through
`POST /decisions/{id}/approve` and requires `approvals:write` (or the
cookie session).

---

## Step 12 — Final timeline

Any agent (or the human) can fetch the full bundle via MCP:

**CLI** (human equivalent)
```bash
gf decision timeline DEC-001
```

**MCP** (what any agent calls — read-only, just needs `decisions:read`)
```
tool:    get_decision_context
args:    { decision_id: "DEC-001" }
returns: { decision:       { ... },
           latest_git:     { commit_hash: "...", files_changed: [...] },
           reviews:        [ { id: "REV-001", findings: [...] } ],
           policy_results: [ ... ],
           disagreements:  [ { topic: "Token rotation timing", ... } ],
           approvals:      [ { approver: "alice@team", status: "approved" } ],
           events: [
             { at: "2026-05-10 14:02:11", kind: "decision.created" },
             { at: "2026-05-10 14:03:45", kind: "decision.git_attached" },
             { at: "2026-05-10 14:03:46", kind: "decision.policy_evaluated" },
             { at: "2026-05-10 14:03:46", kind: "decision.status_changed" },
             { at: "2026-05-10 14:05:12", kind: "review.requested" },
             { at: "2026-05-10 14:08:33", kind: "review.submitted" },
             { at: "2026-05-10 14:08:33", kind: "decision.status_changed" },
             { at: "2026-05-10 14:09:01", kind: "disagreement.recorded" },
             { at: "2026-05-10 14:14:02", kind: "decision.git_attached" },
             { at: "2026-05-10 14:14:02", kind: "decision.policy_evaluated" },
             { at: "2026-05-10 14:18:55", kind: "decision.approved" }
           ] }
```

The same view is available in the cockpit at
`http://localhost:8788/decisions/DEC-001` — Git change panel, policy
breakdown, review findings, the disagreement card, and the
approve/reject controls all on one page.

---

## Step 13 — Audit / replay

The full audit log is queryable. Agents typically don't need this — they
operate on the live decision via `get_decision_context` — but it's the
same data, addressable directly:

```bash
# Every event for the decision
curl -sS "http://127.0.0.1:8787/events?entity_type=decision&entity_id=DEC-001" \
  -H "Authorization: Bearer $GOVFORGE_API_TOKEN" | jq

# Every event for the project
curl -sS "http://127.0.0.1:8787/events?project_path=$(pwd)" \
  -H "Authorization: Bearer $GOVFORGE_API_TOKEN" | jq
```

The `payload_json` on each event is structured. You can replay the
decision lifecycle from the events table alone, without needing the rest
of the schema.

---

## What didn't happen

Same security envelope as the CLI workflow:

- No agent had the ability to execute a shell, push code, reset Git, or
  rebase. The MCP server exposes 11 tools and **zero** of them are
  shell-execution.
- Tokens were checked per-call. An agent calling a tool outside its
  scopes gets a 403 (and the tool isn't even visible in
  `tools/list` thanks to the scope filter).
- No outbound network calls. Everything is local; the MCP server talks
  to the local HTTP API at `127.0.0.1:8787`, the HTTP API talks to the
  local SQLite.
- No file writes outside `.govforge/govforge.db`.
- The final signature stayed a human action. Agents proposed,
  reviewed, disagreed, patched — but the `decision.approved` event
  required a token only the human held.

These properties are pinned by source-grep tests in
[`backend/tests/unit/test_security.py`](../backend/tests/unit/test_security.py)
and documented in [`threat-model.md`](threat-model.md).

---

## See also

- [`workflow-example.md`](workflow-example.md) — the same 13 steps, but
  human-driven via the `gf` CLI.
- [`mcp-integration.md`](mcp-integration.md) — exact MCP wiring snippets
  for Claude Code, Codex, Cursor, Cline.
- [`mcp-reference.md`](mcp-reference.md) — input/output schemas for all
  11 tools, plus resources and prompts.
