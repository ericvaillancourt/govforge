# Outreach — pre-launch warm email

> **Audience**: 10–20 senior engineers / staff+ devs / engineering
> influencers who already write or post about AI coding agents.
> Examples: people running newsletters covering AI dev tooling, OSS
> maintainers in adjacent spaces (linters, code review tools, MCP
> server authors), engineering leads I've shipped with before.
>
> **Goal**: get a *quiet* read 24–72 hours before the public launch.
> Not asking for retweets. Asking for sharp pushback on the data model
> and a heads-up about anything broken.
>
> **Volume**: send ~15. Expect 3–5 replies. Two of those will surface
> real bugs or framing issues — that's the whole point.
>
> **Timing**: Tuesday or Wednesday morning EST, 7–10 days before
> launch. Never on a Friday — replies stall over the weekend.
>
> **Reply SLA**: I commit to replying within 4 hours during EST hours
> for the first 72 hours after sending each email.

---

## Send-list template (per-recipient)

Track in a private Notion / Linear / spreadsheet. Don't BCC a group —
each email goes one-to-one.

| Name        | Role / context                    | Why them                                                       | Sent | Replied | Notes |
|-------------|-----------------------------------|----------------------------------------------------------------|------|---------|-------|
| _example_   | Newsletter "X dev weekly"         | Covered Claude Code launch · 18k subs · technical voice        |      |         |       |
| _example_   | Maintainer of MCP server "Y"      | Adjacent OSS · likely to surface protocol issues               |      |         |       |
| _example_   | VP Eng at fintech                 | Runs an agentic-coding pilot, said audit was the blocker       |      |         |       |

Aim for 2–3 from each bucket: newsletter authors, OSS maintainers in
adjacent spaces, eng leaders running real pilots.

---

## Email — version A (cold-ish, when there's no prior thread)

> **Subject**: Quick gut-check on a governance tool for AI coding agents (you're 1 of ~15)

> Hi {first name},
>
> Short ask. I'm shipping a tool next week called GovForge — it's a
> local-first audit trail for AI coding agents (Claude Code, Codex,
> Cursor, Cline, Aider). Records every code decision an agent makes —
> diff, rationale, policy verdict, peer review, human approval — in
> an append-only SQLite database on the developer's machine. Apache
> 2.0, no telemetry, no cloud.
>
> Before I post on Hacker News, I'm sending it to ~15 people whose
> read I trust to find the embarrassing stuff. You're one of them.
> I'm not asking for a share — I'm asking for 20 minutes of pushback
> on the *data model*, especially the choice to make Disagreement a
> first-class entity rather than a Review subtype.
>
> Repo: https://github.com/ericvaillancourt/govforge
> Site: https://govforge.dev
> Threat model + verifiable security claims:
> https://github.com/ericvaillancourt/govforge/blob/main/SECURITY.md
>
> If it's not your week, no problem — a one-line "pass" is a perfectly
> valid reply. If something jumps out as wrong, I'd rather hear it now
> than from a stranger on HN at 3 AM.
>
> Thanks either way,
> Eric
>
> --
> Eric Vaillancourt · Talsom (Montréal)
> github.com/ericvaillancourt

---

## Email — version B (warm, when there's a prior thread)

> **Subject**: GovForge — would love your read before I post HN

> Hi {first name},
>
> Following up on {specific thing we talked about — incident, pilot,
> dinner, conference talk, a tweet of theirs I replied to}.
>
> Shipping next week: GovForge. Local-first audit trail for AI coding
> agents. The thing you mentioned about {their concern — agents
> rewriting auth in the dark / no review trail / "we can't tell who
> approved this"} is exactly what it's built for.
>
> Before launch I'd love your read on the data model — specifically
> whether Disagreement should be a first-class entity or a Review
> subtype. The threat model and the seven-entity schema are both up
> here:
>
> https://github.com/ericvaillancourt/govforge
>
> Five minutes is plenty. I'd rather hear "the model is wrong because
> X" from you now than discover it on HN.
>
> Thanks,
> Eric

---

## Anti-patterns to avoid

- **Don't ask for shares or upvotes.** It poisons HN and devalues the
  ask. The signal you want is "is this broken", not "will you boost".
- **Don't BCC a group.** Each email goes one-to-one. People can tell.
- **Don't send a press release.** Send the repo. They'll click.
- **Don't follow up more than once.** If they didn't reply in 5 days,
  they're not interested — that's a clean answer.
- **Don't send on a Friday afternoon.** The reply window collapses.
- **Don't include a calendar link.** This is async. If they want a
  call, they'll suggest one.
- **Don't pre-write their tweet.** Patronising and obvious.

---

## Tracking the responses

For each reply, capture in the spreadsheet:

- **Verdict on the model**: "agree it's right" / "disagree, here's
  why" / "no opinion".
- **Bug or doc gap they surfaced**: link to the GitHub issue you
  filed from their feedback.
- **Whether they want a heads-up on launch day**: yes/no.

The `whether they want a heads-up` column is the only thing that
turns into outbound traffic on launch day — and only with their
explicit yes.
