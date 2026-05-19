# Workflow Example — Claude → Codex → Human Approval

> Want the **agent-driven** version of the same workflow, where Claude
> Code and Codex call MCP tools directly? See
> [`workflow-example-agents.md`](workflow-example-agents.md).

A complete walkthrough of the canonical Phase 1 workflow, using real
commands that work today. Each step shows the command, what happens
under the hood, and the expected output.

The scenario: **Claude proposes a session-auth refactor; Codex reviews and
flags a session-fixation risk; the human approves after reviewing.**

## Prerequisites

```bash
# Build the CLI once
cd /path/to/govforge/cli
go build -o ~/bin/gf ./cmd/gf

# Install the backend
cd /path/to/govforge/backend
python -m venv .venv && source .venv/bin/activate
pip install -e .
```

## Step 0 — Initialize the project

```bash
cd ~/code/myrepo
gf init
```

Output:
```
Initialized GovForge project at /home/me/code/myrepo/.govforge
  config:   /home/me/code/myrepo/.govforge/config.toml
  policies: /home/me/code/myrepo/.govforge/policies.toml
  database: /home/me/code/myrepo/.govforge/govforge.db

Next: `gf api serve` to start the local HTTP API.
```

`gf init` is autonomous — it embeds the schema via `go:embed` and applies
it through the pure-Go `modernc.org/sqlite` driver. No backend needed.

## Step 1 — Start the backend

```bash
gf api serve &
gf project status
```

Output:
```
Project
path: /home/me/code/myrepo
database: /home/me/code/myrepo/.govforge/govforge.db
api url: http://127.0.0.1:8787
api: ok — backend 0.1.0
```

You also need to **register the project** with the backend (one-time):

```bash
curl -sS -X POST http://127.0.0.1:8787/projects \
  -H 'Content-Type: application/json' \
  -d '{"name":"myrepo","root_path":"'"$(pwd)"'"}'
```

(In Phase 2 `gf init` will do this automatically. For Phase 1 it's a
manual call.)

## Step 2 — Create a task

```bash
gf task create \
  --title "Migrate auth session to signed cookies" \
  --risk high \
  --actor claude
```

Output:
```
Task created
id: TASK-001
title: Migrate auth session to signed cookies
risk: high
status: open
```

## Step 3 — Claude implements the change

Claude (or any agent connected over MCP — see [`mcp-integration.md`](mcp-integration.md))
modifies the code:

```bash
$EDITOR auth.py middleware/session.py tests/test_auth.py
git add -A
git commit -m "refactor(auth): migrate to signed session cookies"
```

## Step 4 — Record the decision

The agent calls the MCP tool `record_decision`. Equivalent CLI:

```bash
gf decision create \
  --task TASK-001 \
  --author claude \
  --title "Migrate session auth to signed cookies" \
  --summary "Replace server-side session lookup with signed cookie validation" \
  --rationale "Reduce DB roundtrips and simplify middleware" \
  --risk high
```

Output:
```
Decision created
id: DEC-001
title: Migrate session auth to signed cookies
risk: high
status: draft
```

## Step 5 — Attach the Git diff

```bash
gf git attach --decision DEC-001 --commit HEAD --actor claude
```

Output:
```
Git change attached
decision: DEC-001
commit: 7d8b3f4c2a1e0f5d9c8b6e3a2d1f0e9c8b7a6d5e
files: auth.py, middleware/session.py, tests/test_auth.py
insertions: 84
deletions: 31
```

The Git extractor walks `commit.diff(parent)` (or `commit.tree.traverse()`
for the initial commit) and stores `commit_hash`, `branch_name`,
`files_changed`, `insertions`, `deletions`, and `sha256:<hex>` of the
unified diff. Read-only — no Git mutation.

## Step 6 — Run policy checks

```bash
gf policy check --decision DEC-001
```

Output:

| Policy | Status | Message |
|---|---|---|
| `auth_change_requires_review` | blocked | 1 auth-adjacent file(s) modified — review required. |
| `secret_pattern_detection` | passed | No secret patterns detected. |
| `test_required_for_high_risk` | passed | 1 test file(s) modified. |
| `migration_requires_review` | passed | No migration files touched. |
| `large_diff_requires_human_approval` | passed | Diff size 115 within threshold (500). |

Because at least one policy returned `blocked`, `PolicyService` bumped
the decision status to `review_required`.

## Step 7 — Request a review from Codex

```bash
gf review request \
  --decision DEC-001 \
  --reviewer codex \
  --focus security,tests
```

Output:
```
Review requested
decision: DEC-001
status: review_required
reviewer: codex
```

## Step 8 — Codex submits a review

Codex would normally call the MCP tool `submit_review`. Equivalent
direct API call (from a script or another tool):

```bash
curl -sS -X POST http://127.0.0.1:8787/reviews \
  -H 'Content-Type: application/json' \
  -d '{
    "decision_id": "DEC-001",
    "reviewer_agent": "codex",
    "status": "changes_requested",
    "summary": "Session fixation risk",
    "findings": [
      {
        "severity": "high",
        "category": "security",
        "file_path": "middleware/session.py",
        "message": "Session token is not rotated after login",
        "recommendation": "Rotate session token after successful login"
      }
    ]
  }'
```

The decision moves to `changes_requested`.

## Step 9 — Claude records a structured disagreement (optional)

When Codex's finding is contested by Claude, the disagreement is captured
as a first-class entity:

```bash
curl -sS -X POST http://127.0.0.1:8787/reviews/request \
  -H 'Content-Type: application/json' \
  -d '{
    "decision_id": "DEC-001",
    "reviewer_agent": "codex"
  }'   # or via the MCP tool record_disagreement
```

(For Phase 1 there's no `gf disagreement` subcommand — this is exposed
via MCP and the API only.)

## Step 10 — Patch the code

Claude applies the fix:

```bash
$EDITOR middleware/session.py   # rotate session token after login
git add -A
git commit -m "fix(auth): rotate session token after login"
gf git attach --decision DEC-001 --commit HEAD --actor claude
gf policy check --decision DEC-001
```

The new GitChange row attaches under the same decision; both attachments
appear in the timeline.

## Step 11 — Human approval

```bash
gf approve DEC-001 --comment "Approved after token rotation patch and Codex review"
```

Output:
```
Decision DEC-001
status: approved
comment: Approved after token rotation patch and Codex review
```

## Step 12 — Final timeline

```bash
gf decision timeline DEC-001
```

Output:

| At | Entity | Event |
|---|---|---|
| 2026-05-10 14:02:11 | decision | `decision.created` |
| 2026-05-10 14:03:45 | decision | `decision.git_attached` |
| 2026-05-10 14:03:46 | decision | `decision.policy_evaluated` |
| 2026-05-10 14:03:46 | decision | `decision.status_changed` |
| 2026-05-10 14:05:12 | decision | `review.requested` |
| 2026-05-10 14:08:33 | decision | `review.submitted` |
| 2026-05-10 14:08:33 | decision | `decision.status_changed` |
| 2026-05-10 14:14:02 | decision | `decision.git_attached` |
| 2026-05-10 14:14:02 | decision | `decision.policy_evaluated` |
| 2026-05-10 14:18:55 | decision | `decision.approved` |

The same view is available in the cockpit at
`http://localhost:8788/decisions/DEC-001` — with the Git change panel,
policy results breakdown, review findings, and approve/reject buttons
all on one page.

## Step 13 — Audit / replay

The full audit log is queryable:

```bash
# Every event for the decision
curl -sS "http://127.0.0.1:8787/events?entity_type=decision&entity_id=DEC-001" | jq

# Every event for the project
curl -sS "http://127.0.0.1:8787/events?project_path=$(pwd)" | jq
```

The `payload_json` on each event is structured — you can replay the
decision lifecycle from the events table alone, without needing the rest
of the schema.

## Scenario 2 — Retrospective review of a commit already on main

The forward flow above governs **new** changes. The same pipeline also
governs **existing** code on `main` — what people call *post-merge
review*, *retrospective review*, *audit review*, or *brownfield review*.

Use cases: compliance audits, periodic security reviews, pre-refactor
anchoring, post-incident investigations, retros on code an agent shipped
fast, knowledge transfer on bus-factor-1 modules. See
[`github-workflow.md`](github-workflow.md#retrospective-reviews--auditing-code-already-on-main)
for why GitHub alone struggles with this and where GovForge changes the
model.

**Scenario:** Six months after the signed-cookie migration shipped, a
quarterly security audit triggers a retrospective review of `auth.py`
and `middleware/session.py`. The original commit is long-since on
`main`; no new code is being written. The same governance pipeline still
applies — without a merge.

### Step R1 — Create the audit task

```bash
gf task create \
  --title "Audit: session auth module (Q2 2026 security review)" \
  --description "Quarterly retro-review of session handling, post-deploy" \
  --risk high \
  --actor eric
```

Output:
```
Task created
id: TASK-042
title: Audit: session auth module (Q2 2026 security review)
risk: high
status: open
```

Nothing in `gf task create` requires an active working-tree change. A
retro-review task is just a task with no upcoming code.

### Step R2 — Create the decision (no working-tree change)

```bash
gf decision create \
  --task TASK-042 \
  --author eric \
  --title "Retro: session auth — Q2 2026 audit" \
  --summary "Re-evaluating session.py and auth.py for session-fixation risk" \
  --rationale "Scheduled quarterly audit; no behavioral change planned" \
  --risk high
```

Output:
```
Decision created
id: DEC-042
title: Retro: session auth — Q2 2026 audit
risk: high
status: draft
```

### Step R3 — Attach a historical commit (not `HEAD`)

This is the only step that differs from the forward flow. `--commit`
accepts any ref — branch tip, tag, or a specific historical SHA on
`main`:

```bash
gf git attach \
  --decision DEC-042 \
  --commit 7d8b3f4c2a1e0f5d9c8b6e3a2d1f0e9c8b7a6d5e \
  --actor eric
```

Output:
```
Git change attached
decision: DEC-042
commit: 7d8b3f4c2a1e0f5d9c8b6e3a2d1f0e9c8b7a6d5e
files: auth.py, middleware/session.py, tests/test_auth.py
insertions: 84
deletions: 31
```

The extractor walks `commit.diff(parent)` exactly as it would for a
fresh commit. The diff hash and file list are recorded read-only. The
decision is now anchored to the historical change.

### Step R4 — Run policies against the historical code

```bash
gf policy check --decision DEC-042
```

Output:

| Policy | Status | Message |
|---|---|---|
| `auth_change_requires_review` | blocked | 1 auth-adjacent file(s) modified — review required. |
| `secret_pattern_detection` | passed | No secret patterns detected. |
| `test_required_for_high_risk` | passed | 1 test file(s) modified. |
| `migration_requires_review` | passed | No migration files touched. |
| `large_diff_requires_human_approval` | passed | Diff size 115 within threshold (500). |

The policy engine doesn't care whether the commit landed yesterday or
six months ago — it runs against the attached `GitChange` either way.
`auth_change_requires_review` correctly gates the audit on a reviewer.

### Step R5 — Request a reviewer

```bash
gf review request \
  --decision DEC-042 \
  --reviewer codex \
  --focus security,session-fixation
```

Output:
```
Review requested
decision: DEC-042
status: review_required
reviewer: codex
```

### Step R6 — Codex submits the audit review

Same MCP tool (`submit_review`) or direct API call as the forward flow.
In the audit case, Codex reads the historical diff cold and either signs
off or flags drift:

```bash
curl -sS -X POST http://127.0.0.1:8787/reviews \
  -H 'Content-Type: application/json' \
  -d '{
    "decision_id": "DEC-042",
    "reviewer_agent": "codex",
    "status": "approved",
    "summary": "Session rotation verified against follow-up patch",
    "findings": [
      {
        "severity": "info",
        "category": "security",
        "file_path": "middleware/session.py",
        "message": "Session rotation confirmed present (added in DEC-001 follow-up).",
        "recommendation": "No action — keep the regression test that pins the rotation behavior."
      }
    ]
  }'
```

The decision moves to `approved` on the review side.

### Step R7 — Approve the audit decision (no merge happens)

```bash
gf approve DEC-042 --comment "Closed Q2 2026 audit cycle"
```

Output:
```
Decision DEC-042
status: approved
comment: Closed Q2 2026 audit cycle
```

No git push, no merge, no branch operation. The audit decision is
sealed in the event log, queryable via the same `/events` endpoint as
any forward decision.

### Why this is structurally interesting

- **Historical policies still apply.** The policy engine runs against
  the attached `GitChange` whether it's on `main` or a feature branch,
  whether it's a year old or one minute old.
- **Append-only audit trail = same legal weight.** A retrospective
  audit recorded in the event log has the same provenance properties
  as a forward audit: `payload_json`, signed timestamps, immutable.
- **No `kind` enum on `Decision` — and that's a feature.** The schema
  doesn't distinguish "forward" from "retro" decisions. The same state
  machine (`draft → review_required → approved`) governs both. A
  retro-review is simply a decision created after the commit is
  already on `main`.
- **Proactive policies can drive retro-reviews automatically.** A
  Phase 2 policy like `unreviewed_main_commit` (not yet implemented)
  could open audit tasks for any commit touching `auth/*` that hasn't
  been reviewed by a second person within 90 days — turning compliance
  into a queue, not an event.
- **Bulk retro-reviews via agents.** Point Codex at a list of 50
  legacy commits with a focused prompt (`find session-fixation
  patterns`) — it can create 50 decisions, attach 50 diffs, submit 50
  reviews. You triage the queue, not the code.

For the agent-driven walkthrough of the same retro scenario, see
[`workflow-example-agents.md` → Scenario 2](workflow-example-agents.md#scenario-2--asking-claude-to-run-a-retro-review-on-legacy-code).

## What didn't happen

- No git push, reset, rebase, or any other write-side Git verb.
- No file writes outside `.govforge/govforge.db`.
- No outbound network calls.
- No tool was given the ability to execute a shell.

These properties are pinned by source-grep tests in
[`backend/tests/unit/test_security.py`](../backend/tests/unit/test_security.py)
and documented in [`threat-model.md`](threat-model.md).
