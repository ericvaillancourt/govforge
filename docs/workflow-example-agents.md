# Workflow example — vibe-coder edition

*Zero CLI commands after setup. You just chat with your AI coding agent
the way you already do; GovForge records the decision, runs the policy
checks, and keeps the audit trail in the background.*

This is the same end-to-end governance flow as
[`workflow-example.md`](workflow-example.md), but told from the
perspective of a developer who lives in their AI assistant and would
rather not learn a new CLI. The whole story is a conversation. The only
shell you'll see is the one-time setup at the top.

The scenario:
**You ask Claude Code to refactor your session auth. Codex reviews it,
catches a security issue. Claude patches it. You click "Approve" once.
Done.**

---

## Setup (you do this once)

> 👤 **One-time** — copy/paste, ~2 minutes. After this you never need
> to touch a shell to use GovForge.

Install the CLI + backend, initialize your repo, and mint one token per
agent:

```bash
# 1. Install once
brew install ericvaillancourt/tap/govforge          # or `pipx install govforge`

# 2. In any repo you want governed
cd ~/code/my-app
gf init                                              # creates .govforge/
gf api serve --port 8787 &                           # starts the local API

# 3. One token per agent (you'll paste each into the agent's MCP config)
gf token create --label claude-author   --agent claude \
  --scopes tasks:write,decisions:write,reviews:write,decisions:read,reviews:read
gf token create --label codex-reviewer  --agent codex \
  --scopes reviews:write,reviews:read,decisions:read
```

Each `gf token create` prints a `gfp_…` secret **once**. Drop each one
into the MCP config of the matching agent — exact JSON snippets per
client (Claude Code, Codex, Cursor, Cline) live in
[`mcp-integration.md`](mcp-integration.md).

That's it. Open your IDE. From here on, everything happens in chat.

---

## Step 1 — Tell Claude what you want

You're in Claude Code in your IDE. You type:

> Hey, I want to migrate our session auth from server-side lookups to
> signed cookies. It touches `auth.py` and `middleware/session.py`.
> This is auth-adjacent — flag it as high-risk in GovForge before you
> start.

Claude:

*Opens a task in GovForge.*

> Got it. I've registered this as **TASK-001** (risk: high) in
> GovForge so the change is on the record. I'll write the code, then
> record the decision and run the policy checks when I'm done. Anything
> specific you want me to watch out for?

You:

> Make sure cookies are signed (HMAC) and that we keep the existing
> CSRF protection. Add tests.

Claude:

> On it.

---

## Step 2 — Claude writes the code and records the decision

You wait. Claude edits the files, runs your test suite, and commits.
Then, without you having to ask, it wraps the change up in GovForge:

Claude:

> Here's what I did:
>
> - Replaced `SessionMiddleware` with `SignedCookieMiddleware` in
>   `middleware/session.py`.
> - Removed the server-side session lookup in `auth.py`.
> - Updated `tests/test_auth.py` with 4 new cases (sign, verify,
>   tamper-detect, expiry).
> - Committed as `refactor(auth): migrate to signed session cookies`.
>
> *Records the decision in GovForge and attaches the diff.*
>
> The decision is now **DEC-001** in GovForge with the diff attached
> (84 insertions, 31 deletions across 3 files). I'm going to run the
> policy checks next — give me a second.

You don't have to type anything. Claude continues.

---

## Step 3 — Claude runs the policy checks

Claude:

*Runs the GovForge policy checks against DEC-001.*

> Policy results are in:
>
> - `auth_change_requires_review` → **blocked** (1 auth-adjacent file
>   modified — review required)
> - `secret_pattern_detection` → passed
> - `test_required_for_high_risk` → passed (1 test file modified)
> - `migration_requires_review` → passed
> - `large_diff_requires_human_approval` → passed
>
> The decision moved to **`review_required`**. That auth-adjacent
> policy is exactly the guardrail you wanted — it's stopping the
> change from being approved without a second pair of eyes. Want me
> to request a review from Codex?

You:

> Yes, ask Codex to focus on session security and the test coverage.

Claude:

*Requests a review from Codex with the focus tags `security, tests`.*

> Done. DEC-001 is on Codex's queue.

---

## Step 4 — Switch to Codex, ask it to review

Open Codex (or your second Claude chat, or whichever agent has the
reviewer token wired in). You type:

> Take a look at DEC-001 in GovForge. Focus on session security and
> test coverage.

Codex:

*Reads the diff, the rationale, and the policy results from GovForge.*

> I've read DEC-001 — the JWT cookie migration. The diff covers
> `auth.py`, `middleware/session.py`, and `tests/test_auth.py`. The
> tests look sensible. One thing concerns me though.

You:

> What?

Codex:

> **Session fixation risk** in `middleware/session.py`: the session
> token isn't rotated when a user logs in successfully. An attacker
> who plants a pre-login cookie could replay it after the victim
> authenticates.
>
> I'm submitting that as a high-severity finding and marking the
> decision as `changes_requested` so Claude can patch.
>
> *Submits the review to GovForge with the finding.*
>
> Done. The author can see my finding in the cockpit and act on it.

---

## Step 5 — Back to Claude, ask for the fix

Switch back to Claude Code:

> Codex flagged a session-fixation risk in `middleware/session.py` on
> DEC-001 — apparently we're not rotating the session token after
> login. Can you read the finding and fix it?

Claude:

*Pulls the decision context from GovForge, including Codex's finding.*

> Saw it. Codex is right — we issue the cookie on
> `SessionMiddleware.attach()` but never call `rotate()` after
> `login_user()` succeeds. I'll add the rotation call and a regression
> test that fails without it.

You:

> Go.

(You wait. Claude edits, runs tests, commits.)

Claude:

> Patched. New commit:
> `fix(auth): rotate session token after login`. I've re-attached the
> diff to DEC-001 and re-run the policy checks — they all pass now,
> and Codex's specific finding has been addressed in the new commit.
> The decision is ready for your final approval.

---

## Step 6 — Approve in the cockpit

This is the only step that doesn't happen in chat. By design — GovForge
**deliberately** withholds approval rights from any agent token, so the
final signature is always a human.

Open the GovForge cockpit at <http://localhost:8788/decisions/DEC-001>
in your browser. You'll see, on one page:

- the full diff (both commits — initial + patch),
- the policy results breakdown,
- Codex's finding and the recommendation,
- Claude's patch commit annotated to the finding,
- a green **Approve** button at the top.

Click it. Add a one-line comment if you want
(*"Approved after Codex review + token rotation patch"*). The decision
moves to `approved`. The audit trail is now closed and immutable.

---

## Scenario 2 — Asking Claude to run a retro-review on legacy code

The flow above governs **new** changes. The same setup also governs
**existing** code on `main` — code that shipped weeks or months ago
that nobody is actively touching. People call this a *retrospective
review*, *audit review*, or *brownfield review*; see
[`github-workflow.md`](github-workflow.md#retrospective-reviews--auditing-code-already-on-main)
for why it's a recognized practice and why GitHub alone struggles with
it.

You don't learn a new flow for this. You ask Claude the same way you
asked it to write code — except instead of *making* a change, it's
*auditing* one.

**Scenario:** Six months after the session-cookie migration shipped,
you're running a quarterly security audit and want a clean retro-review
on `auth.py` and `middleware/session.py`. Same Claude, same Codex, same
cockpit. No merge involved.

### Step A1 — Tell Claude what you want audited

In Claude Code:

> Hey, six months ago we shipped the signed-cookie session migration.
> We're doing our Q2 2026 security audit and I want a clean retro-review
> on `auth.py` and `middleware/session.py`. Open a retro-review task in
> GovForge, attach commit `7d8b3f4` (the original migration), run the
> policies, then ask Codex to take a fresh look at session fixation.

Claude:

*Opens a task in GovForge — risk: high, no upcoming code, audit-flavored.*

> Got it. I've opened **TASK-042** in GovForge: "Audit: session auth
> module (Q2 2026 security review)" at high risk. I'll record the
> decision, attach the historical commit, run the policies, then queue
> Codex.

You don't reply. Claude continues.

---

### Step A2 — Claude attaches the historical commit

You wait a moment. Claude:

> Done:
>
> - **DEC-042** recorded against TASK-042 with the audit rationale.
> - Attached commit `7d8b3f4` to the decision read-only — 84 insertions,
>   31 deletions across `auth.py`, `middleware/session.py`,
>   `tests/test_auth.py`.
> - Ran the policy checks. Same result as when this shipped originally
>   — `auth_change_requires_review` is **blocked**, which is the gate
>   you want for an audit. Everything else passes.
> - Decision is sitting at **`review_required`**.
>
> Asking Codex now.

Two things to notice: (1) Claude didn't have to write any new code, and
(2) `gf git attach` accepted a historical SHA — it doesn't have to be
`HEAD`. The same MCP tool (`attach_git_diff`) takes a `commit_hash`
parameter; defaulting to `HEAD` was just a convention of the forward
flow.

---

### Step A3 — Switch to Codex, ask for the cold review

In Codex:

> Take a look at DEC-042 in GovForge. It's a retro-review on the
> session-cookie migration from six months ago. Focus specifically on
> session-fixation patterns and confirm whether the rotation we added in
> the follow-up is actually present and tested.

Codex:

*Pulls the decision context — diff, file list, policy results — from GovForge.*

> I've got it. Reading `auth.py`, `middleware/session.py`, and
> `tests/test_auth.py` from the diff attached to DEC-042.

(A few seconds pass.)

> Verified:
>
> 1. `SignedCookieMiddleware.attach()` issues the signed cookie on
>    request.
> 2. `login_user()` in `auth.py` calls `session.rotate()` after a
>    successful authentication — the rotation we added in the DEC-001
>    follow-up is present.
> 3. `tests/test_auth.py` has a regression test that would fail if the
>    rotation were removed.
>
> No session-fixation risk surfaces in the current state. I'm marking
> the review as **approved** with an informational finding pinning the
> regression test as critical.
>
> *Submits the review to GovForge.*

The decision is now ready for your sign-off.

---

### Step A4 — Approve in the cockpit

Open the cockpit at <http://localhost:8788/decisions/DEC-042>. The page
looks identical to the forward case:

- the full diff of the historical commit,
- the policy results breakdown,
- Codex's audit finding + recommendation,
- a green **Approve** button at the top.

Click it. Comment: *"Closed Q2 2026 audit cycle"*. The decision moves
to `approved`. The audit is now part of the immutable event log,
queryable via `/events` exactly like every forward decision.

---

### What this gives you that GitHub alone can't

- **Review decoupled from merge.** No `[REVIEW-ONLY]` PR tricks, no
  comment-on-commit fragmentation. The audit is a first-class decision
  with the same lifecycle as a forward change.
- **Structured findings, not free-form threads.** Codex's audit
  finding carries severity, category, file path, and recommendation —
  queryable, summable across many audits.
- **Bulk retro-reviews are tractable.** Want to audit every commit
  that touched `auth/*` in the last year? Point Claude at the commit
  list with one prompt; it opens 30 decisions, attaches 30 diffs,
  queues 30 reviews. You triage the queue, not the code.
- **Append-only event log = audit-grade provenance.** A retro-review
  recorded today has the same legal weight as one done at merge time.
  Auditors care about *recorded, timestamped, immutable* — not *when*.

---

## What just happened (the part you didn't have to think about)

Behind every prompt above, the agent was talking to a local API and
recording everything for you:

- **TASK-001** opened by Claude (one event in the timeline).
- **DEC-001** created, with title, rationale, and risk level.
- The Git diff hash + file list, attached read-only — GovForge never
  modifies your repo.
- 5 policies evaluated, each result persisted.
- Codex's review (REV-001) with the structured finding (severity, file,
  recommendation).
- The patch commit, re-attached and re-checked.
- Your final approval, signed.

You can replay any of it in the cockpit. The decision detail page is
also the audit trail for that change — there's no separate "logs" view
to dig through.

---

## You won't run into the agent doing the wrong thing

Two guardrails work in the background:

1. **Tokens are scoped per role.** Claude's token can author tasks and
   decisions; Codex's token can review. Neither can approve. If an
   agent tried to call `approve_decision` (it can't — the tool isn't
   even visible in its `tools/list`), the server would refuse the call
   with a 403. The role is enforced by the system, not by your prompt
   wording.
2. **The agent doesn't have a shell.** GovForge gives agents exactly
   11 tools and zero of them are shell-execution. They can read your
   repo, but they can't `git push`, `git reset`, run subprocesses, or
   reach the network. Pinned by source-grep tests in
   [`backend/tests/unit/test_security.py`](../backend/tests/unit/test_security.py)
   and documented in [`threat-model.md`](threat-model.md).

You can chat freely and not worry that a misread prompt could ship code
to production.

---

## Curious what's actually happening?

If you want to see the calls behind each chat exchange:

- [`workflow-example.md`](workflow-example.md) — the same workflow,
  but driven by `gf …` CLI commands. Useful if you ever want to script
  a step.
- [`mcp-reference.md`](mcp-reference.md) — the 11 MCP tools each agent
  uses, with input/output schemas.
- [`mcp-integration.md`](mcp-integration.md) — exact MCP config
  snippets for Claude Code, Codex, Cursor, Cline.

**You don't need to know any of that to use it.** That's the point.
