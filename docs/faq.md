# FAQ

The questions that come up most often. If something here is wrong or
incomplete, [open a discussion](https://github.com/ericvaillancourt/govforge/discussions)
or send a PR.

## What is GovForge in one sentence?

A local-first audit + review layer for AI coding agents — every code
decision they make gets a Git-attached, policy-checked, peer-reviewed,
human-approved record in an append-only timeline.

## Why local-first?

Three reasons. (1) The data is your code's metadata — diffs, file paths,
review notes. We don't want it on someone else's server. (2) The threat
model is much smaller when the only network surface is the agent's MCP
client. (3) It runs at any speed — there's no cloud round-trip on a
policy check.

## Does GovForge work without Claude / Codex / etc.?

Yes. The entire system is operable from the `gf` CLI alone. The MCP
server is the agent-facing surface; you can drive the whole workflow
through HTTP / CLI without it. That said — the audit value is much
higher when an agent is the one creating decisions, because that's
where the *why* lives.

## Can I use it without the MCP server?

Yes. `gf api serve` starts the HTTP API; the cockpit + CLI work fully
without ever launching `gf mcp serve`. MCP only matters if an agent
should be making decisions on your behalf.

## How is this different from Cursor / Copilot / GitHub Codespaces?

Those are *coding* tools — they generate code. GovForge is a
*governance* tool — it records what the coding tools did, why, and
whether anyone signed off. They're complementary: Cursor proposes,
GovForge audits.

## How is it different from a code-review platform (GitHub PRs, Reviewboard, …)?

PR review happens after a human packages a change. GovForge captures
the loop *one level earlier* — when an agent (Claude, Codex) is making
the change, often with no human in the loop until merge. The
disagreement between two agents on the same decision is a first-class
entity here; it has nowhere to live in a PR-only workflow.

## What does the MCP server actually expose?

11 tools, 5 resources, 3 prompts — all non-destructive. See
[`mcp-reference.md`](mcp-reference.md). No tool spawns a shell, no tool
writes to Git, no tool deletes data. The threat model
([`threat-model.md`](threat-model.md)) lists every guarantee and points
at the test pinning it.

## Can agents bypass GovForge?

Yes — agents can edit code without ever calling `record_decision`.
GovForge is a discipline, not a sandbox. The point is to make the
"recorded" path the path of least resistance:

- The MCP integration adds one tool call per decision.
- The agent gets richer context back (`get_decision_context`,
  `govforge://decision/...`), so it's worth participating.
- A human can configure their CI to require a `decision.approved`
  event before a merge — making the discipline enforceable at the
  org boundary.

## Can I add my own policies?

Yes. One Python class, one entry in the registry, one test. Step-by-step
in [`policy-authoring.md`](policy-authoring.md).

## How do I migrate from SQLite to Postgres?

Phase 1 is SQLite-only. The schema is portable — `core.models` uses
SQLAlchemy 2 generic types (`Uuid`, `DateTime(timezone=True)`, `JSON`) —
so a Phase 3 Postgres backend is a `DATABASE_URL` swap and an Alembic
migration. We're not promising it works today; we're promising the
schema doesn't paint us into a corner.

## Why Apache 2.0 instead of MIT or AGPL?

Apache 2.0 carries a patent grant that MIT doesn't, which matters for
a project whose policies might tangle with future patent filings around
AI-driven code generation. AGPL would scare off the enterprise
audience that GovForge is positioned for. The MCP / data-model
interfaces are designed to be embedded, not hidden.

## What's the relationship between `gf` (Go) and the Python backend?

`gf` is a **client**. It talks to the backend over HTTP on
`127.0.0.1:8787`. The exception is `gf init`, which is autonomous —
it embeds the SQL schema and creates the database without the backend
running. Beyond that, every command is a thin wrapper around an HTTP
call.

## Can I run the backend without the Go CLI?

Yes. `python -m govforge.api.server` and `python -m govforge.mcp.server`
are the canonical entry points. The Go CLI just spawns these with the
right `GOVFORGE_DB` env var set.

## Where's the data?

`./.govforge/govforge.db` — a single SQLite file. Back this up; lose it
and you lose the audit log. There's no Phase 1 export → re-import path.

## Is there telemetry?

No. There are no outbound network calls in Phase 1 from the backend.
The marketing site at `govforge.dev` doesn't run analytics either —
this is verifiable by looking at the rendered HTML.

## Is this production-ready?

It depends. Phase 1 is feature-complete with 90% backend test
coverage and security guarantees pinned by source-grep tests. It's
suitable for a single-developer / small-team workflow on local
hardware. Multi-user, RBAC, SSO, signed approvals, formal compliance
reports — those are Phase 3.

## How do I sponsor / contribute / hire support?

- Code contributions: see [CONTRIBUTING.md](../CONTRIBUTING.md).
- Open governance discussions: GitHub Discussions.
- Commercial support, custom policies, on-prem deployment help: email
  [`hello@govforge.dev`](mailto:hello@govforge.dev). Phase 3 SaaS will
  have a pricing page.

## What's on the roadmap?

The strategic roadmap is internal (it contains commercial
positioning + dates that change). The public-facing TL;DR:

- **Phase 1** — MVP local. Done.
- **Phase 2** — public launch + distribution channels (PyPI / Homebrew /
  pre-built binaries) + a video walkthrough + Show HN.
- **Phase 3** — SaaS / multi-user / RBAC / SSO / signed approvals.
- **Phase 4+** — formal compliance reporting (SOC 2, EU AI Act, Loi 25
  Quebec), enterprise packaging, ecosystem (custom policy marketplace).

If a specific item matters to you, please file a
[Discussion](https://github.com/ericvaillancourt/govforge/discussions)
— that's how items move from "later" to "next."
