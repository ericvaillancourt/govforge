# Reddit Posts — Per-subreddit Variants

> Reddit hates cross-posting and even more strongly hates "I built X,
> please upvote." Each variant below is **rewritten** for the
> audience, not copy-pasted. Post each one on a different day across
> launch week, not all on launch day.
>
> Read each subreddit's rules before posting — most have a self-promo
> ratio (e.g. r/programming requires you to have engaged on the sub
> before posting your own work).

---

## r/programming

**Title** (≤ 300 chars; first 8 words matter most):

```text
GovForge: a local-first audit trail for AI coding agents (Apache 2.0, MCP-native)
```

**Body** (Markdown):

```text
I built this because every time Claude Code, Codex or Cursor ships a
refactor for me, the only record of *why* it happened is a chat log
that closes with the IDE tab.

GovForge is a local-first governance layer that captures every
code-shaping decision an AI agent makes: rationale, diff
(Git-attached, read-only), automated policy results, peer-agent
reviews, structured disagreement, and the explicit human approval at
the end. Append-only audit log in SQLite, no SaaS, no telemetry.

Stack: Python (FastMCP + FastAPI + SQLAlchemy 2) + Go CLI +
Next.js cockpit. Apache 2.0. The MCP server (11 tools, 5 resources,
3 prompts) is the agent-facing surface; the rest is plain HTTP.

Three guarantees pinned by source-grep tests in CI:

  - MCP tools never `import subprocess` / `os.system` / call eval/exec.
  - The Git extractor uses an allowlist of seven verbs (diff, show,
    log, rev_parse, ls_tree, rev_list, cat_file).
  - `assert_path_in_repo` rejects symlinks that escape the repo root.

Default policies: auth-change requires review, secret pattern detection,
test-required-for-high-risk, migration requires review, large-diff
requires human approval. Adding a custom one is one Python class.

Repo: https://github.com/ericvaillancourt/govforge
Docs + threat model: https://govforge.dev/en/docs/

Genuinely interested in pushback on the model — especially from anyone
running multi-agent setups in real codebases.
```

**What NOT to put in the body**

- ⛔ "Please star the repo if you like it" — auto-flag.
- ⛔ "I worked X months on this" — irrelevant to the reader.
- ⛔ Emojis. r/programming hates them.

**Replies playbook**

| Top comment shape           | Reply shape                                              |
|-----------------------------|----------------------------------------------------------|
| "How is this different from <X>?" | One sentence + link to FAQ entry.                  |
| "Just use git notes / commit messages" | Concede the legit part, then explain why a separate sqlite db survives rebases and is queryable. |
| "What about agents that bypass it?" | "Agents can edit code without calling record_decision. The point is to make the recorded path the path of least resistance — and to let CI gate on the decision.approved event." |

---

## r/MachineLearning

**Title**:

```text
[P] GovForge — open-source MCP governance for AI coding agents (audit trail, policy engine, structured disagreement)
```

The `[P]` prefix is mandatory for project posts. r/ML is more academic
— frame as a research-ish positioning piece.

**Body**:

```text
TL;DR: an open-source governance layer for AI coding agents that
captures decision rationale, diff evidence, peer-agent reviews,
structured disagreement, and human approval as first-class queryable
entities. Local-first SQLite audit log. Apache 2.0.

The motivating observation is that current agentic coding workflows
have a striking asymmetry: the *output* (code) is durably recorded by
Git; the *reasoning chain* (why this design, what alternatives were
ruled out, what the reviewer agent objected to, who signed off) is
ephemeral. It lives in chat windows that close with the IDE tab.

GovForge models this reasoning chain explicitly:

  - Decision: the central primitive. Has a risk level, a rationale,
    and a status state machine.
  - GitChange: read-only Git evidence attached to a Decision.
  - PolicyResult: automated check against project policies (5 ship
    enabled by default; a Policy is a pure function of the Decision +
    its GitChange).
  - Review + Finding: structured peer-agent feedback (severity,
    category, file, message, recommendation).
  - Disagreement: a first-class entity capturing where two agents
    diverge. Optional `requires_human_decision` flag.
  - Approval: the human gate. Final state.
  - Event: append-only audit trail. The full timeline is replayable
    from this table alone.

The MCP server (FastMCP, stdio) exposes 11 tools to any MCP client
(Claude Code, Codex, Cursor, Cline, Aider, Continue, Zed). Schemas are
Pydantic; the Go CLI mirrors them.

What GovForge deliberately doesn't do: generate code, edit Git, run a
shell, or send anything to a remote service. The threat model is
pinned by source-grep tests in CI.

Phase 1 is single-developer + local. Phase 3 will add the SaaS layer
(RBAC, SSO, signed approvals) for teams.

Repo: https://github.com/ericvaillancourt/govforge
Architecture + data model: https://govforge.dev/en/docs/

Open to academic / research feedback. The data model is the part I'd
most like critiqued — particularly the choice to make Disagreement a
first-class entity rather than a Review subtype.
```

---

## r/devops

**Title**:

```text
We're shipping AI-generated migrations with no audit trail. I built a thing.
```

r/devops responds to operational-pain framing.

**Body**:

```text
On-call at 3 AM, paged for a migration that broke prod. The migration
was committed by an AI agent two days earlier. The agent reasoned about
the change in a Cursor chat. The chat is gone.

Reconstructing what the agent was thinking — its risk assessment,
which alternatives it ruled out, whether anyone reviewed — is
guesswork. The audit log doesn't exist.

GovForge is the audit log. Every code-shaping decision an AI agent
makes goes into an append-only SQLite store on the dev's machine:

  · the rationale the agent recorded
  · the diff (Git-attached, hashed)
  · the policy check results
  · the peer-agent review with structured findings
  · any structured disagreement
  · the explicit human approval

CI can gate on a `decision.approved` event before merge — turning the
discipline into a hard requirement at the org boundary.

  $ gf decision timeline DEC-001
  ╭─────────────────────┬──────────┬───────────────────────────╮
  │ AT                  │ ENTITY   │ EVENT                     │
  ├─────────────────────┼──────────┼───────────────────────────┤
  │ 2026-05-10 14:02:11 │ decision │ decision.created          │
  │ 2026-05-10 14:03:45 │ decision │ decision.git_attached     │
  │ 2026-05-10 14:03:46 │ decision │ decision.policy_evaluated │
  │ 2026-05-10 14:08:33 │ decision │ review.submitted          │
  │ 2026-05-10 14:18:55 │ decision │ decision.approved         │
  ╰─────────────────────┴──────────┴───────────────────────────╯

Local-first. No SaaS. Apache 2.0.
Stack: Python backend (FastMCP + FastAPI + SQLAlchemy) + Go CLI.

Try it:

  curl -fsSL https://govforge.dev/install.sh | sh
  pipx install govforge

Repo: https://github.com/ericvaillancourt/govforge
```

---

## r/golang

**Title**:

```text
gf — a single-binary CLI for governing AI coding agents (Cobra + Viper + lipgloss + go:embed)
```

r/golang cares about the build, not the product story.

**Body**:

```text
Sharing a CLI I built as part of GovForge — a local-first audit layer
for AI coding agents. The Go side is the user-facing surface; the
backend is Python.

What's interesting from a Go perspective:

  - Single static binary, no cgo. Uses modernc.org/sqlite (pure-Go
    driver) so `gf init` can apply the embedded SQL schema without
    any C dependency.
  - The schema, default policies, and config template are bundled via
    go:embed at build time. CI dumps the schema from SQLAlchemy
    metadata and snapshots it into cli/internal/embed/assets/.
  - HTTP client uses resty for the typed wrapper, with a small
    `Time` shim that tolerates the backend's occasional TZ-naive
    ISO timestamps.
  - Cobra root has documented exit codes (0 ok / 1 user / 2 backend /
    3 network) — `classifyError` is the central translator.
  - Coverage: 75–100% per package via httptest.Server fakes.
    `go test -race` clean.
  - Cross-compile via GoReleaser: linux/darwin/windows × amd64/arm64,
    SBOM via Syft, cosign keyless signing on checksums.

Repo (the CLI is in cli/):
https://github.com/ericvaillancourt/govforge

Specifically curious about feedback on:

  - Embedding the SQL schema. The pattern works but couples the Go
    side to the SQLAlchemy dump format. A check-script in CI ensures
    they don't drift, but I'd love to know if anyone's solved this
    cleaner.
  - The Time shim. Necessary because SQLite drops TZ on round-trip,
    so the backend sometimes emits "...11:35:24.637121" without "Z".
    Handled with a custom UnmarshalJSON. Better solutions welcome.
```

---

## Posting cadence

| Day      | Sub                | Notes                                                  |
|----------|--------------------|--------------------------------------------------------|
| Tue AM   | Show HN            | Best slot, least competition.                          |
| Tue PM   | r/golang           | Different audience, won't conflict with HN.            |
| Wed AM   | r/programming      | Has the highest reach + harshest mods. Be ready.       |
| Wed PM   | LinkedIn long-form | Engineering leaders.                                   |
| Thu AM   | r/MachineLearning  | Academic-leaning audience.                             |
| Thu PM   | r/devops           | Operational framing.                                   |
| Fri      | Quiet day          | Watch + reply. Don't post anywhere new.                |
| Mon (+1) | dev.to / Medium    | Long-form blog post (separate file).                   |

Reddit posts can also be reposted to topic-specific subs (r/Anthropic,
r/LocalLLaMA, r/selfhosted) **only** if you've engaged on those subs
before. Don't carpet-bomb.
