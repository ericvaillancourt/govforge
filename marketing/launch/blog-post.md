# Blog Post — "Why I Built GovForge"

> **Targets**: dev.to (canonical), Medium (cross-post with canonical
> tag pointing back at dev.to), Hashnode (optional). Don't post first
> on Medium — they aggressively wall content behind their paywall.
>
> **Length**: 1,200–1,800 words. Long enough to have substance, short
> enough that someone reads it on a coffee break.
>
> **Voice**: first-person, low-key, technical. Engineering-narrative,
> not founder-blog. The pattern: open with a concrete failure I
> witnessed, walk through the design, end with the open invitation.

---

## Title options

1. ✅ **"Your AI agent just rewrote auth. Did anyone read it?"**
   (most viral, opens with a question)
2. **"Building a local-first audit trail for AI coding agents"**
   (more measured, plays better on dev.to's homepage)
3. **"What I learned shipping a multi-agent governance tool"**
   (better fit if we want to lean on the build retrospective angle)

Recommend option 1. The other two are fallbacks if dev.to flags
clickbait.

## Tags

dev.to: `opensource`, `ai`, `governance`, `mcp`, `golang`
Medium: `Open Source`, `Software Engineering`, `AI`, `Audit`, `MCP`

## Hero image

Use the OG image from `site/src/app/opengraph-image.tsx` — same
charcoal canvas, brand mark + tagline. dev.to needs a 1000×420
horizontal crop.

---

## Body

```markdown
> Six months ago I started letting AI agents write production code for
> me. They were good at it. I shipped refactors, migrations, even auth
> changes I'd previously have spent days on. Until on-call paged me at
> 3 AM for a migration the agent had landed two days earlier.

> The migration broke production. Reconstructing *why* the agent had
> made it — the risk classification, the alternatives it had ruled out,
> whether anyone had checked — was guesswork. The agent's reasoning
> chain lived in a Cursor chat that closed when I closed the tab. The
> repo only had the diff.

> So I built the audit trail.

> ## The asymmetry

> Modern coding agents — Claude Code, Codex, Cursor, Cline, Aider — are
> good. They write idiomatic code, they run tests, they handle multi-file
> refactors. The asymmetry that bothers me isn't that they're imperfect
> (humans are). It's that the *output* of agentic coding is durably
> recorded by Git, while the *reasoning chain* is ephemeral.

> When a senior engineer makes a contentious call on a refactor, that
> conversation lives somewhere — Slack thread, design doc, PR review,
> retrospective deck. When an agent makes the same call, the
> conversation lives in an IDE chat that gets garbage-collected the
> moment the developer hits Cmd-W.

> Six months of agentic coding compounded that asymmetry into a
> governance debt I couldn't see the bottom of.

> ## What was missing, concretely

> I went hunting for the smallest set of *durable artefacts* that would
> have let me reconstruct the migration that woke me up. I landed on
> seven:

> 1. **Decision** — the unit of governance. A title, summary,
>    rationale, risk level. The thing the agent was doing, in writing.
> 2. **GitChange** — the diff, attached read-only. Commit hash, files,
>    insertions, deletions, SHA-256 of the unified diff.
> 3. **Policy results** — what automated checks ran. Did the auth-change
>    rule fire? Did the secret-pattern detector match? Did large-diff
>    require human approval? The verdict per policy.
> 4. **Review** — feedback from another agent or a human, with
>    *structured* findings (severity, category, file path, line range,
>    recommendation). Not a chat blob.
> 5. **Disagreement** — first-class. When two agents look at the same
>    change and disagree on whether it's safe, that disagreement is the
>    interesting record, not the noise.
> 6. **Approval** — explicit human signoff. Final state.
> 7. **Event** — append-only audit log. The chronological record. Every
>    mutating operation writes one. The full timeline can be replayed
>    from this table alone.

> Those seven things became the SQLAlchemy model layer of GovForge.

> ## The constraint that shaped everything: local-first

> The instinct when you start a project like this is to reach for a SaaS.
> "Centralised governance dashboard for your AI agents." It would have
> been easier to build, easier to monetise.

> I picked the opposite trade-off, deliberately:

> - **No outbound network calls.** The MCP server uses stdio. The HTTP
>   API binds to 127.0.0.1. The cockpit UI is on localhost:8788. The
>   only persistent storage is `.govforge/govforge.db` — a SQLite file
>   on the dev's machine.
> - **No telemetry.** Zero. Verifiable: source-grep tests in CI fail
>   the build if anyone introduces an outbound HTTP client into the
>   MCP package.
> - **Apache 2.0.** Open core. The local OSS path stays free forever.
>   A future SaaS layer (RBAC, SSO, signed approvals, SOC 2 reports)
>   targets teams that need it; the OSS path will not be neutered.

> Two reasons for the constraint:

> 1. **The data is your code's metadata.** Diffs, file paths, review
>    notes, approval comments. I don't want it on someone else's server.
>    More importantly: I shouldn't expect anyone *else* to want it on
>    my server.
> 2. **The threat model is much smaller.** When the only network
>    surface is the agent's MCP client (which is also local), the
>    attack surface is the local OS user account. We don't have to
>    secure a remote API.

> ## Why MCP

> The [Model Context Protocol](https://modelcontextprotocol.io) was
> the right interface because it lets the *agent* drive. GovForge
> exposes 11 tools, 5 read-only resources, and 3 prompt templates over
> stdio. The agent calls `record_decision`, `attach_git_diff`,
> `request_review`, `submit_review`, `approve_decision`, etc.

> The CLI (`gf`, single Go binary) and the cockpit UI are *also*
> first-class clients of the same backend. Anything you can do via MCP
> you can do via the HTTP API or the CLI. They're parallel surfaces,
> not layers.

> ## What I deliberately didn't build

> The Phase 1 scope is small on purpose:

> - **No multi-user.** Phase 1 is single-developer + local. Concurrent
>   access to the SQLite is technically supported (WAL mode), but
>   collaboration features wait for Phase 3.
> - **No code generation.** GovForge doesn't write code. It records
>   what code-writing tools did. The two responsibilities don't share
>   a binary.
> - **No web dashboard for executives.** Phase 1 is for the developer
>   at their desk. Reporting / compliance / executive views land in
>   Phase 4.
> - **No destructive Git operations.** The Git extractor uses an
>   allowlist of seven read-only verbs. A test in CI fails the build
>   if anyone introduces a write-side verb.

> Restraint is a feature.

> ## The model is the product

> The interesting thing about GovForge isn't the code (it's small —
> ~3k lines of Python, ~2k lines of Go, ~1k lines of TypeScript). It's
> the *model* — the choice of which seven entities to make first-class.

> If you're building anything in the AI-coding-agent space, the data
> model below the surface is going to define what's possible:

> - Did you make Disagreement a first-class entity, or is it a chat
>   blob?
> - Is your audit log queryable, or is it print statements?
> - Can the timeline be replayed without the rest of the schema?
> - Are policy results queryable per-decision, or are they a one-shot
>   blocker?

> The choices compound. Pick wrong early and you can't fix it later
> without breaking the audit promise to existing users.

> ## Try it

> ```bash
> # 30-second install:
> curl -fsSL https://govforge.dev/install.sh | sh
> pipx install govforge

> # 5-minute walkthrough:
> cd ~/your/repo && gf init && gf api serve &
> gf task create --title "Refactor auth" --risk high --actor claude
> gf decision create --task TASK-001 --author claude --title "Sign cookies" --risk high
> gf git attach --decision DEC-001
> gf policy check --decision DEC-001
> gf review request --decision DEC-001 --reviewer codex
> gf approve DEC-001 --comment "OK after rotation patch"
> gf decision timeline DEC-001
> ```

> Repo: <https://github.com/ericvaillancourt/govforge>
> Docs (architecture, data model, MCP integration, threat model):
> <https://govforge.dev/en/docs/>

> ## Open invitation

> If you're running multi-agent setups in real codebases, I'd love
> pushback on the model — especially on the choice to make
> Disagreement a first-class entity rather than a Review subtype.
> Open a GitHub Discussion or email me at
> [hello@govforge.dev](mailto:hello@govforge.dev).

> The threat model lists every security guarantee with the test that
> pins it. If any of them turns out to be holes, that's the bug.
> Please report it: <https://github.com/ericvaillancourt/govforge/blob/main/SECURITY.md>.

> Open source. Apache 2.0. Local-first. govforge.dev.
```

---

## Cross-post checklist

- [ ] dev.to canonical (post first here)
- [ ] Medium with canonical tag pointing at dev.to
- [ ] Hashnode (optional, last 24h post)
- [ ] LinkedIn shorter version (separate file: `linkedin.md`)
- [ ] Personal blog mirror with canonical tag
- [ ] Submit to https://lobste.rs/stories/new (highly technical sub-audience)
- [ ] Submit to https://news.ycombinator.com (Show HN, separate file)
