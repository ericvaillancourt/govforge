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
