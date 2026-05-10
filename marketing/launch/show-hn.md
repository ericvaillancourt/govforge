# Show HN Post

> **Timing**: post 8:30–9:30 AM ET (peak HN traffic). Avoid Mondays
> (weekend backlog floods front page) and Fridays (weekend slump).
> Best windows: Tuesday / Wednesday / Thursday morning.
>
> **Account**: post from a real account with prior comment activity.
> A 0-karma account posting "Show HN" with a polished website is
> auto-flagged.

## Title (≤ 80 chars)

```text
Show HN: GovForge – Local-first audit trail for AI coding agents
```

Reasoning: HN respects "Show HN:" prefix, dislikes hype words. "Local-first"
+ "audit trail" + "AI coding agents" gives precise scope without
buzzwords. 65 chars — leaves room.

## Body (~250 words)

```text
Hi HN,

I built GovForge after watching Claude Code, Codex and Cursor land
production-grade refactors in repos I work on — and realising the only
record of *why* a change happened was a chat log that got closed when
the IDE tab did.

GovForge is a local-first governance layer for AI coding agents. It
captures every code-shaping decision: the rationale, the diff, the
result of policy checks, peer-agent reviews, and the final human
approval. Append-only audit log. No SaaS, no telemetry, no network
egress. Apache 2.0.

The architecture is three components that all run on your machine:

  - A FastMCP server (11 tools) that agents talk to via stdio.
  - A FastAPI HTTP API on 127.0.0.1:8787 for the CLI + cockpit.
  - A Go binary `gf` for humans, plus a Next.js cockpit at :8788.

Concrete claims, all pinned by tests in CI:

  - MCP tools never spawn a subprocess or call eval/exec
    (source-grep test in test_security.py).
  - The Git extractor is read-only: an allowlist of seven verbs
    (diff/show/log/rev_parse/ls_tree/rev_list/cat_file).
  - Path traversal is refused: assert_path_in_repo rejects symlinks
    that escape the repo root.

Five default policies ship with `gf init`: auth changes require
review, secret patterns block, high-risk decisions need tests,
migrations require review, large diffs require human approval.

What's deliberately *not* there: cloud sync, multi-user, RBAC.
Phase 1 is single-developer + local. Phase 3 (later) adds the
SaaS/RBAC/SSO layer.

Try it:

  curl -fsSL https://govforge.dev/install.sh | sh
  pipx install govforge
  cd ~/your/repo && gf init && gf api serve

Repo: https://github.com/ericvaillancourt/govforge
Workflow walkthrough: https://govforge.dev/en/docs/

Genuinely interested in pushback on the model, especially from anyone
running multi-agent setups in real codebases.
```

Word count: ~265. Slightly over the 250 target but every paragraph
earns its place. Trim the architecture bullets if it gets pushback for
length.

## First comment (post within 90 s of submitting)

The first comment is the de-facto "lead-author elaborates" slot on Show
HN. Use it to disarm two predictable objections:

```text
A few things I expect people will ask about, so I'll get ahead:

1. "Why not just use a PR review tool?"

   PR review happens after a human packages the change. GovForge captures
   the loop one level earlier — when the agent is making the change,
   often with no human in the loop until merge. The structured
   disagreement between two agents (Claude proposes, Codex objects) is
   a first-class entity here; it has nowhere to live in a PR-only
   workflow.

2. "Can agents bypass it?"

   Yes — agents can edit code without ever calling record_decision.
   GovForge is a discipline, not a sandbox. The point is to make the
   recorded path the path of least resistance: the MCP integration adds
   one tool call per decision, the agent gets richer context back via
   get_decision_context, and a CI gate can require a decision.approved
   event before merge.

3. "What's the relationship with Anthropic / OpenAI / etc.?"

   None. Apache 2.0, vendor-neutral. The MCP server works with any
   MCP client (Claude Code, Codex, Cursor, Cline, Aider, Continue,
   Zed, anything that speaks MCP).

The threat model + every security guarantee → its corresponding test:
https://github.com/ericvaillancourt/govforge/blob/main/docs/threat-model.md
```

## Second comment (deploy if a question about scope/competition lands)

```text
> How is this different from <Cursor / Copilot / GitHub Codespaces>?

Those are coding tools — they generate code. GovForge is a governance
tool — it records what the coding tools did, why, and whether anyone
signed off. Complementary, not competitive: Cursor proposes, GovForge
audits. The integration point is MCP, which Cursor + Cline + Claude
Code + Codex all already speak.
```

## Don'ts

- **Don't link Twitter / X / LinkedIn** in the post body. HN downvotes
  cross-promotion.
- **Don't use marketing copy.** "Revolutionary", "next-gen",
  "AI-powered" are auto-discount signals on this audience.
- **Don't argue defensively in replies.** When someone says "I don't
  see the value," concede the legitimate part of their critique
  before clarifying. Two-line replies > three-paragraph defences.
- **Don't ask people to upvote.** Mods watch for this; it's the fastest
  way to get flagged.
- **Don't post and ghost.** Be present in the thread for the first 4
  hours. Reply within 15 minutes for the first hour.

## Replies playbook (top 5 likely questions)

| Question                                              | Reply (first sentence)                                        |
|-------------------------------------------------------|---------------------------------------------------------------|
| "Why not commit signing / git notes?"                 | "Git notes don't survive rebases and aren't queryable. The audit log is a separate sqlite db so the timeline persists across history rewrites." |
| "How big can the SQLite get?"                         | "About 5 KB per decision in our tests. 10k decisions ≈ 50 MB. Phase 3 adds Postgres for multi-user." |
| "Why Python + Go instead of one language?"            | "Backend in Python because SQLAlchemy / FastAPI / FastMCP were the right tools and Python is what the agents already speak. CLI in Go because we want a single static binary that drops into a developer's PATH without a runtime." |
| "Can I use it without MCP?"                           | "Yes. The CLI + HTTP API work fully without ever launching the MCP server. MCP is the agent-facing surface; the rest is plain HTTP." |
| "Is the data really local-first or are you tracking?" | "Verifiable: zero outbound network calls in Phase 1. The threat model lists every guarantee with the test that pins it. Source-grep proof, not a privacy promise." |
