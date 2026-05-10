# X / Twitter Thread

> 7 tweets. Post the whole thread at once (X's "Add tweet" UI), don't
> drip-feed — engagement on dripped threads collapses after 2 hours.
>
> **Best window**: Tuesday/Wednesday/Thursday, 9–11 AM ET or 2–4 PM ET.
> Avoid weekends — dev Twitter is quiet.
>
> Pin the thread on the GovForge brand account if/when one exists; for
> launch day post from Eric's personal account.

## Tweet 1 (the hook — must work in isolation)

```text
Your AI agent just rewrote your authentication code.
Did anyone read it?

I built GovForge so the answer is "yes, and here's the audit trail."

Open source · Apache 2.0 · Local-first.
🧵👇
```

108 characters before the thread emoji. Leaves room for an embedded
image or 1-card preview.

**Image**: 1200×675 PNG. The OG image (`/opengraph-image`) works as-is.
Or a custom shot of the cockpit's Decision Detail page with the
timeline visible.

## Tweet 2 (problem)

```text
AI agents now ship migrations, refactors and architecture decisions.

The repo only sees the diff.

The *why* — and the risk — disappears the moment the IDE tab closes.

A PR review can't catch what was never explicitly recorded.
```

## Tweet 3 (solution shape)

```text
GovForge captures every code-shaping decision an AI agent makes:

  · the rationale
  · the diff (Git-attached, read-only)
  · policy results
  · peer-agent reviews
  · structured disagreement
  · explicit human approval

Append-only. Queryable. Local-first by design.
```

## Tweet 4 (the killer demo line — paste a screenshot of the timeline)

```text
The result: every decision is one command away from a clean audit
trail.

  $ gf decision timeline DEC-001

[image: cockpit screenshot of /decisions/DEC-001 showing the 8-event
timeline including decision.created → decision.git_attached →
decision.policy_evaluated → review.requested → review.submitted →
decision.approved]
```

## Tweet 5 (the differentiator)

```text
Three guarantees, all pinned by tests in CI:

  1. MCP tools never spawn a subprocess or call eval/exec.
  2. The Git extractor is read-only — allowlist of seven verbs.
  3. Path traversal refused (symlink escape rejected).

This is governance plumbing, not another LLM wrapper.
```

## Tweet 6 (the ask + practical)

```text
Try it in 30 seconds:

  curl -fsSL https://govforge.dev/install.sh | sh
  pipx install govforge
  gf init
  gf api serve &

Works with Claude Code, Codex, Cursor, Cline, Aider — anything that
speaks MCP.

⭐ → https://github.com/ericvaillancourt/govforge
```

## Tweet 7 (the soft close)

```text
Phase 1 ships single-developer + local-first.

Phase 3 will add the SaaS layer (RBAC, SSO, signed approvals,
SOC 2/Loi 25/AI Act foundations) for teams that need it.

Open core. The OSS path stays free forever.

Thoughts? What would make this useful for your team?
```

## Replies playbook

| Reply         | Response                                                                |
|---------------|-------------------------------------------------------------------------|
| Bot reply     | Ignore. Don't reply, don't block (clears the bot signal for the algo).  |
| Praise        | Thank, then ask what they'd want next. Drives a follow-up engagement.   |
| Critique      | Concede the legitimate part. One sentence. Don't argue.                  |
| "How is this different from X?" | One sentence + link to the FAQ entry. Don't paste the FAQ. |
| Feature request | "Tracked: <link to a Discussion or Issue>." Open the discussion if it isn't there yet. |

## Variant: solo tweet (when the thread feels too heavy)

```text
Built a local-first audit layer for AI coding agents.

  $ gf decision timeline DEC-001

Every diff your agent shipped → who proposed it, what policies blocked
it, who reviewed, who approved. SQLite, append-only, Apache 2.0.

[asciinema GIF]

https://github.com/ericvaillancourt/govforge
```
