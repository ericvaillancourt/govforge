# MCP Reference

Complete reference for everything the GovForge MCP server exposes:
**11 tools**, **5 resources**, **3 prompts**. Phase 1 is stdio-only.

For wiring instructions per agent (Claude Code, Codex, Cursor, Cline)
see [`mcp-integration.md`](mcp-integration.md). Source of truth for
schemas: [`backend/src/govforge/mcp/schemas.py`](../backend/src/govforge/mcp/schemas.py).

## Conventions

- Identifiers at the boundary are **display IDs** (`TASK-001`,
  `DEC-001`, `REV-001`), not UUIDs.
- Agent names are free-form strings. The server auto-creates an `Agent`
  row on first use; the `AgentType` is inferred from the name
  (`claude` → `CLAUDE`, `eric` → `HUMAN`).
- Tools are **non-destructive**. A failed call rolls back its DB session.
- All tools take individual typed parameters (no wrapping `payload`
  object) — the published JSON schema matches the flat shapes in
  [`devis.md`](https://github.com/ericvaillancourt/govforge/blob/main/devis.md) §10.2.

## Common types

```python
RiskLevel        = "low" | "medium" | "high" | "critical"
DecisionStatus   = "draft" | "review_required" | "changes_requested" | "approved" | "rejected"
TaskStatus       = "open" | "in_progress" | "review_required" | "approved" | "rejected" | "closed"
ReviewStatus     = "approved" | "changes_requested" | "commented" | "rejected"
FindingSeverity  = "info" | "low" | "medium" | "high" | "critical"
FindingCategory  = "security" | "performance" | "architecture" | "bug" | "maintainability" | "tests"
PolicyResultStatus = "passed" | "warning" | "blocked"
ApprovalStatus   = "approved" | "rejected" | "needs_changes"
```

---

# Tools

## `create_task`

Create a Task on the project at `project_path`.

**Input**

| Field           | Type        | Default    | Note                                         |
|-----------------|-------------|------------|----------------------------------------------|
| `project_path`  | str         | required   | Absolute path of a registered project        |
| `title`         | str         | required   |                                              |
| `description`   | str?        | null       |                                              |
| `risk_level`    | RiskLevel   | `medium`   |                                              |
| `actor_agent`   | str?        | null       | Auto-created if unknown                      |

**Output**

```json
{ "task_id": "TASK-001", "status": "open" }
```

**Emits** — `task.created` event.

---

## `record_decision`

Create a Decision linked to a Task. The Task's project is inherited.

**Input**

| Field                        | Type        | Default     |
|------------------------------|-------------|-------------|
| `task_id`                    | str (TASK-) | required    |
| `author_agent`               | str         | required    |
| `title`                      | str         | required    |
| `summary`                    | str?        | null        |
| `rationale`                  | str?        | null        |
| `risk_level`                 | RiskLevel   | `medium`    |
| `human_approval_required`    | bool        | `false`     |

**Output**

```json
{ "decision_id": "DEC-001", "status": "draft" }
```

**Emits** — `decision.created`.

---

## `attach_git_diff`

Run the read-only Git extractor on `repo_path` at `commit_hash` and
persist a `GitChange` row.

**Input**

| Field            | Type      | Default   |
|------------------|-----------|-----------|
| `decision_id`    | str (DEC-)| required  |
| `repo_path`      | str       | required  |
| `commit_hash`    | str       | `"HEAD"`  |
| `actor_agent`    | str?      | null      |

**Output**

```json
{
  "decision_id": "DEC-001",
  "files_changed": ["auth.py", "middleware/session.py"],
  "insertions": 84,
  "deletions": 31,
  "diff_hash": "sha256:7f9b3..."
}
```

**Emits** — `decision.git_attached`.

**Refused** — paths outside the repo root after symlink resolution
(`PathOutsideRepoError`).

---

## `run_policy_checks`

Evaluate every active policy against the decision's latest GitChange.

**Input**

| Field            | Type        | Default                                |
|------------------|-------------|----------------------------------------|
| `decision_id`    | str (DEC-)  | required                               |
| `config_path`    | str?        | `.govforge/policies.toml` if present   |
| `actor_agent`    | str?        | null                                   |

**Output**

```json
{
  "decision_status": "review_required",
  "results": [
    { "policy": "auth_change_requires_review", "status": "blocked",
      "message": "1 auth-adjacent file(s) modified — review required." },
    { "policy": "secret_pattern_detection", "status": "passed",
      "message": "No secret patterns detected." }
  ]
}
```

**Side-effects** — persists one `PolicyResult` per policy; if any
returns `blocked` and the decision was `draft`, bumps it to
`review_required`. Emits `decision.policy_evaluated` (and
`decision.status_changed` on a status bump).

---

## `request_review`

Mark a decision as `review_required` and tag a reviewer agent.

**Input**

| Field             | Type         | Default      |
|-------------------|--------------|--------------|
| `decision_id`     | str (DEC-)   | required     |
| `reviewer_agent`  | str          | required     |
| `focus`           | list\[str\]  | `[]`         |
| `actor_agent`     | str?         | null         |

**Output**

```json
{ "decision_id": "DEC-001", "status": "review_required" }
```

**Emits** — `review.requested` with `reviewer_agent_id` + `focus`.

---

## `submit_review`

Persist a Review with structured findings.

**Input**

| Field               | Type                 | Default     |
|---------------------|----------------------|-------------|
| `decision_id`       | str (DEC-)           | required    |
| `reviewer_agent`    | str                  | required    |
| `status`            | ReviewStatus         | required    |
| `summary`           | str?                 | null        |
| `findings`          | list\[Finding\]      | `[]`        |

**Finding** shape:

| Field            | Type             |
|------------------|------------------|
| `severity`       | FindingSeverity  |
| `category`       | FindingCategory  |
| `file_path`      | str?             |
| `line_start`     | int?             |
| `line_end`       | int?             |
| `message`        | str              |
| `recommendation` | str?             |

**Output**

```json
{ "review_id": "REV-001", "decision_id": "DEC-001", "decision_status": "changes_requested" }
```

**Status mapping** (review → decision):

| Review status         | Decision becomes        |
|-----------------------|-------------------------|
| `changes_requested`   | `changes_requested`     |
| `rejected`            | `rejected`              |
| `approved`            | unchanged (human gate)  |
| `commented`           | unchanged               |

**Emits** — `review.submitted` (and `decision.status_changed` if mapped).

---

## `record_disagreement`

Create a structured disagreement on a decision.

**Input**

| Field                        | Type        | Default  |
|------------------------------|-------------|----------|
| `decision_id`                | str (DEC-)  | required |
| `topic`                      | str         | required |
| `author_position`            | str?        | null     |
| `reviewer_position`          | str?        | null     |
| `risk_summary`               | str?        | null     |
| `requires_human_decision`    | bool        | `true`   |
| `actor_agent`                | str?        | null     |

**Output**

```json
{ "disagreement_id": "<uuid>", "decision_id": "DEC-001", "requires_human_decision": true }
```

**Emits** — `disagreement.recorded`.

---

## `approve_decision`

Final human gate.

**Input**

| Field            | Type             | Default   |
|------------------|------------------|-----------|
| `decision_id`    | str (DEC-)       | required  |
| `approver`       | str              | required  |
| `status`         | ApprovalStatus   | required  |
| `comment`        | str?             | null      |

**Output**

```json
{ "decision_id": "DEC-001", "decision_status": "approved", "approval_status": "approved" }
```

**Emits** — `decision.approved` / `decision.rejected` /
`decision.needs_changes` depending on the status.

---

## `get_decision_context`

Return the full bundle for a decision: decision row + latest git change
+ reviews + policy results + disagreements + approvals + timeline events.

**Input** — `decision_id` (str).

**Output** — a structured object; see
[`schemas.GetDecisionContextOutput`](../backend/src/govforge/mcp/schemas.py).
The `events` array is sorted ascending by `created_at`.

---

## `list_open_reviews`

Reviews on decisions still in `review_required`.

**Input** — `project_path` (str).

**Output**

```json
{
  "reviews": [
    { "review_id": "REV-001", "decision_id": "DEC-001",
      "reviewer_agent": "codex", "status": "changes_requested" }
  ]
}
```

---

## `list_pending_approvals`

Decisions awaiting human approval (`human_approval_required: true` and
status in `review_required` / `changes_requested`).

**Input** — `project_path` (str).

**Output**

```json
{
  "decisions": [
    { "decision_id": "DEC-001", "title": "...",
      "risk_level": "high", "status": "changes_requested" }
  ]
}
```

---

# Resources

Read-only context handles, addressed by URI. Project resources use the
project's UUID; decision/task/review resources use display IDs.

## `govforge://project/{project_id}/policies`

Active policies for the project.

```json
{
  "project_id": "<uuid>",
  "policies": [
    { "name": "auth_change_requires_review", "description": "...",
      "severity": "high", "config": { "patterns": ["auth", "session", ...] } }
  ]
}
```

## `govforge://decision/{decision_id}`

Full decision payload — same shape as `get_decision_context` minus the
events array (use the timeline resource for that).

## `govforge://task/{task_id}/timeline`

Chronological events for the task and every decision linked to it.

```json
{
  "task_id": "TASK-001",
  "events": [
    { "type": "task.created", "entity_type": "task",
      "created_at": "2026-05-10T14:02:11Z", "payload": { ... } }
  ]
}
```

## `govforge://review/{review_id}`

Full review payload with all structured findings.

## `govforge://project/{project_id}/conventions`

**Phase 1 placeholder.** Returns an empty list. Phase 2 wires it to a
forthcoming `Convention` model so projects can publish their own
coding-standard guidance to agents.

---

# Prompts

Static text templates. Each takes a single `decision_id` (and `focus`
for review) argument and returns a single message body the calling
agent can forward to its model.

## `review_code_decision(decision_id, focus="security,tests,architecture")`

Pushes the reviewer toward producing **structured findings** rather than
vague comments. Asks for `severity` / `category` / `file_path` /
`line_range` / `message` / `recommendation` per finding — which lines up
with the `submit_review` finding schema.

## `explain_disagreement(decision_id)`

Mediator-style synthesis of opposing positions:

1. The actual conflict (stripped of surface phrasing).
2. Steelman of the author's position.
3. Steelman of the reviewer's position.
4. Risk if the reviewer is right and the author's version ships.
5. Two-to-four specific questions for the human.

## `summarize_decision(decision_id)`

Audit-ready summary — readable months later by someone who wasn't in
the loop. Five required parts: what changed, why, risks identified +
mitigation, approval chain (with IDs), final state.

Full template text in
[`backend/src/govforge/mcp/prompts.py`](../backend/src/govforge/mcp/prompts.py).
