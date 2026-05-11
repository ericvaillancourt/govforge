# LinkedIn Post — Engineering Long-Form

> **Audience**: CTOs, VPs of Engineering, principal engineers at
> medium-to-large companies. The framing is risk + accountability,
> not "cool dev tool." LinkedIn rewards posts that read like a brief
> trade-press article.
>
> **Format**: 1,200–1,500 chars. Single carousel image OR
> a 90-second native video. No external link in the post body —
> LinkedIn algorithmically penalises that. Drop the link in the
> first comment.
>
> **Timing**: Tuesday or Wednesday, 7:30–9:00 AM in the audience's
> timezone. Don't post on Mondays (people clear inbox) or Fridays.

## Post body

```text
Six months ago I started letting Claude Code, Codex and Cursor write
production code for me. Refactors, migrations, even auth changes
shipped without me ever opening a PR review tool.

The audit trail of *why* any of it happened: the chat log in the IDE.
Closed when I closed the tab.

This is not a hypothetical risk for engineering leaders. It's a
governance gap that compounds every week as agentic coding tools get
more capable. Three concrete failure modes I've seen:

· An agent confidently writes a session-auth refactor. Six commits
  in, a senior reviewer notices a session-fixation hole in the
  rationale that was never recorded.

· Two agents working on the same task disagree. The disagreement
  surfaces in chat, gets resolved verbally, and never lands in a
  durable record. Six months later nobody remembers why.

· A migration ships through CI in 8 minutes. The risk classification
  was never explicit. The on-call engineer at 3 AM has nothing to
  reconstruct what the agent was thinking.

I built GovForge to close that gap.

It's a local-first governance layer that captures every code-shaping
decision an AI agent makes: rationale, diff (Git-attached and
read-only), automated policy checks, peer-agent reviews, structured
disagreement, and explicit human approval. Append-only. Queryable.
No SaaS, no telemetry.

Three guarantees pinned by source-grep tests in CI:

  · MCP tools never spawn a shell process or call eval/exec.
  · The Git extractor is read-only — allowlist of seven verbs.
  · Path traversal is refused at the OS layer.

Apache 2.0. Open core. The local OSS path is free forever; teams
who need RBAC / SSO / signed approvals / formal compliance reports
will get a hosted Phase-3 option.

If this resonates with how your team uses agentic coding tools, I'd
welcome a 20-minute call. The link is in the first comment.

#AICoding #DevOps #Governance #OpenSource #SOC2 #ModelContextProtocol
```

Char count: ~1,400. Edit down further if it shows as truncated in the
preview.

## First comment (where the link goes)

```text
Repo + docs + threat model:
https://github.com/ericvaillancourt/govforge

Workflow walkthrough (Claude → Codex → human approval):
https://govforge.dev/en/docs/

If you'd rather skip the post: pipx install govforge && gf init.
```

## Carousel option (5 slides if going visual)

| #   | Headline                                          | Body                                                                 |
|-----|---------------------------------------------------|----------------------------------------------------------------------|
| 1   | "Your AI agent just shipped to production."       | Subhead: "Did anyone record why?" — brand mark + stark dark slide.   |
| 2   | "The gap"                                         | The three failure modes from the post body, one bullet each.         |
| 3   | "What GovForge captures"                          | Six tags: rationale · diff · policy · review · disagreement · approval |
| 4   | "Three guarantees pinned by tests"                | The three security invariants with the test name underneath.         |
| 5   | "Try it in 30 seconds"                            | The three install commands + repo URL.                               |

Build the carousel from the OG image template (in the marketing site
repo at `src/app/opengraph-image.tsx`) — same charcoal background + the
brand mark in the corner of every slide.

## What not to do

- **No "I'm thrilled to announce…"** Engineering leaders skim past
  it. Lead with a problem they recognise.
- **No emojis in the body.** The few people who care will appreciate
  the restraint; the rest don't notice.
- **No founder selfie.** A clean diagram or a code screenshot performs
  better in this audience.
- **Don't tag people who haven't agreed in advance** — a tag without
  consent creates a passive-aggressive obligation. Send a DM first.
