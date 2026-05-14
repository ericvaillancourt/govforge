# GovForge — Public Roadmap

GovForge is a **local-first governance layer for AI coding agents** —
tasks, decisions, reviews, approvals, and an append-only audit trail,
all wired into MCP so agents like Claude Code and Codex can be governed
the same way humans are.

Reviews are multidimensional — security, architecture, patterns,
performance, and compliance show up as **governance lenses** on top of
every AI-recorded decision, not as standalone scanners. GovForge stays
opinionated about workflow and audit trail; specialized scanners stay
opinionated about their domain.

This roadmap covers user-visible direction. Concrete shipped changes
live in [`CHANGELOG.md`](./CHANGELOG.md); per-package detail in
[`backend/`](./backend/), [`cli/`](./cli/), [`ui/`](./ui/),
[`vscode/`](./vscode/), and [`site/`](./site/).

Conventions:
- **Now** — currently in flight, will land in the next minor release.
- **Next** — committed for the following minor release.
- **Later** — strategic phases, designs not yet finalized.

---

## Now — v0.2 (in flight)

VS Code extension grows up from "read-only sidebar" to a real cockpit.

- **React webview forms** for the heavy actions: Submit Review (with
  dynamic findings list), Create Task, Record Decision. Replaces the
  `showQuickPick` / `showInputBox` wizards from v0.1 — every field
  visible at once, inline validation, single submit.
- **Role-aware UI** — the extension queries a new `GET /me` endpoint at
  sign-in and hides commands the token can't run. A persistent **Focus
  mode** picker (status bar: All / Author / Reviewer / Approver) lets
  multi-scope users narrow their UI to one workflow at a time without
  losing capabilities.
- **CLI/extension auth sync** — when the OS keyring is unavailable
  (Linux without `gnome-keyring`), the extension falls back to the same
  chmod-0600 `~/.config/govforge/auth.toml` the `gf` CLI uses, so
  signing in via either tool signs in both.

## Next — v0.3 (committed)

- **VS Code Marketplace publish** — current install path is `vsce
  package` + `code --install-extension`. The Marketplace listing
  follows the v0.2 form work shipping.
- **Submit Review / Record Disagreement / Request Review** as webview
  forms (the last three commands still using the wizard flow).
- **5-minute Quickstart reproducible by an external dev** with no help
  — single Markdown page validated against a clean machine.
- **Demo video / asciinema** linked from README + site hero.
- **MCP registry submissions** — Anthropic's official registry +
  community registries (Smithery, mcp.so, glama.ai, awesome-mcp-servers).
- **Launch posts** (HN, Reddit `r/programming` / `r/selfhosted`).
- **Cockpit role-aware UI parity** — the Next.js cockpit gains the same
  scope-driven button gating the VS Code extension has today
  (`ApprovalActions.tsx` currently shows all buttons unconditionally).
- **Structured findings v1** — every finding emitted by GovForge gets a
  typed shape (`severity`, `dimension`, `category`, `file`, `message`,
  `recommendation`, `source`) so downstream tools, the cockpit, and the
  VS Code diagnostics can group and filter consistently. `source` traces
  whether a finding came from a native policy, an external tool import,
  or an agent reviewer.
- **Phase 1 governance policies** — minimal built-ins: secrets exposure,
  auth-sensitive files modified, dangerous subprocess usage, forbidden
  imports, simple layering violations. Findings flow through the same
  audit timeline as agent-written ones — no separate scanner UI.

## Later — strategic phases

Direction-only. None of these are committed dates.

### Governance review dimensions (Phase 2 of policies)

Each lens surfaces structured findings into the same decision timeline;
reviewers don't context-switch between tools.

- **Security review** — auth/session, JWT, permissions, SQL injection,
  secrets, unsafe crypto, ACL.
- **Architecture review** — DDD boundaries, layering, repository
  pattern, dependency direction, anti-patterns.
- **Pattern consistency review** — async consistency, naming
  conventions, factory usage, CQRS, dependency-injection rules.
- **Performance review** — N+1 queries, allocation hotspots, cache
  bypass, blocking I/O in async handlers.
- **Compliance review** — PII exposure, sensitive logging, retention,
  AI Act / Loi 25 / GDPR mapping.

**Third-party tool integration** — GovForge stays opinionated about
workflow, not implementations. Output from Semgrep, CodeQL, Ruff,
SonarQube, Snyk and similar tools gets converted into structured
findings on the GovForge timeline (`source: "semgrep"`, etc.). We don't
rebuild what they already do well.

### Observability & memory (Phase 2)
- Per-agent event sourcing beyond what `/decisions/{id}/timeline`
  exposes today.
- Context snapshots — capture what an agent saw at decision time so a
  reviewer can re-derive the same context months later.
- Decision-quality metrics (acceptance rate, time-to-approve, finding
  density by category).

### Team & SaaS Beta (Phase 3)
- Team workspaces — multiple users on one GovForge project with shared
  decision timelines and review queues.
- Notifications — Slack / Teams / email when a decision needs review
  or an approval is pending.
- Hosted backend with the same single-binary local mode preserved.

### AI Governance Intelligence (Phase 3 of policies)

Beyond rule-based policies, GovForge learns from project history:

- **Architecture drift detection** — flag decisions that move the
  codebase away from previously approved patterns.
- **Convention learning** — derive project-specific conventions from
  approved decisions; surface deviations as findings.
- **Contextual pattern analysis** — the same diff scored differently in
  a service-layer file vs. a controller, weighted by the agent type
  that authored it.
- **Historical decision comparison** — for each new decision, surface
  the 3 most-similar past decisions and their outcomes ("the last 3
  times we approved a similar change, here's what went wrong").

### Enterprise (Phase 4)
- RBAC — fine-grained roles beyond the current scope model.
- SSO / SAML.
- Air-gapped deployment topology (no outbound calls; bring-your-own LLM
  endpoints).
- Compliance posture: SOC 2 Type 2 evidence pack, Loi 25 (Quebec) data
  residency, EU AI Act traceability mapping, audit-export bundle
  (JSONL + Markdown).

### Extensibility (Phase 5)
- Plugin SDK — third-party policies, custom finding categories, custom
  review templates.
- Marketplace for published policies and review templates.
- First-party integrations: GitHub PR comments, GitLab MR threads,
  Jira / Linear ticket links, Azure DevOps work items.

---

## Out of scope

- **Cryptographic signature on approvals** — useful but not on the
  current critical path; revisit when an enterprise customer asks.
- **Replacing the audit log with a blockchain** — append-only file +
  hash chain is enough for the threat model; see `docs/threat-model.md`.

---

## How to influence this roadmap

- File an issue with the `kind/feature` label on
  [`github.com/ericvaillancourt/govforge`](https://github.com/ericvaillancourt/govforge/issues).
- Or open a discussion under
  [`Discussions / Ideas`](https://github.com/ericvaillancourt/govforge/discussions/categories/ideas).
- Items with the most "+1" reactions and concrete use cases get pulled
  forward.
