# Dogfood journal — Phase 2.5

> Eric uses GovForge on this repo (or another active project) for 1-2 weeks
> via Claude Code / Codex / Cursor. Goal : find every friction before public
> launch. This file is the source of truth for what to fix.

**Started**: <fill on day 1>
**Window target**: 1-2 weeks
**Owner**: Eric (solo per Phase 2.5 acted decision)

---

## Frictions found (rolling summary)

> Add new entries on top. Severity: 🔴 blocker / 🟠 friction / 🟢 polish.
> Link each entry to a GitHub issue once filed.

| Severity | Friction | Where | Issue | Status |
|---|---|---|---|---|
| _none yet_ | | | | |

---

## What "ship-ready" looks like at the end of this window

A blocker-free run of the canonical workflow on a fresh repo, by Eric, in
under 10 minutes:

1. `gf init` in a clean Git repo → no error, `.govforge/` populated.
2. Claude Code (via MCP) creates a task + decision + attaches a real commit.
3. `gf policy check --decision DEC-001` runs all 5 policies, output legible.
4. Codex (separate session) submits a review with at least one finding.
5. Disagreement is recorded between author and reviewer.
6. Eric runs `gf approve DEC-001 --comment "..."` → audit timeline complete.
7. Cockpit UI (`gf ui serve`) renders the full timeline correctly.

If any step requires reading source code or grepping logs to recover, that's
a 🟠 friction. If any step fails outright, that's a 🔴 blocker.

---

## Daily entries

> Format below. Add a new dated section at the TOP each session.

### 2026-MM-DD (session N)

**Workflow attempted**: e.g., "Claude proposes a refactor of `cli/internal/render/` ;
ask GovForge to record decision + run policies + request Codex review."

**What worked**:
- ...

**What didn't**:
- ...

**Time spent**: ~Xh
**Issues opened**: #NN, #NN
**Insights**: anything surprising — e.g., "the policy output is too quiet
for a CI context", "the FR doc banner is too small to notice", etc.

---

### Template (copy above when starting)

```
### 2026-MM-DD (session N)

**Workflow attempted**: 

**What worked**:
- 

**What didn't**:
- 

**Time spent**: 
**Issues opened**: 
**Insights**: 
```

---

## Recurring patterns to watch

These are the suspicions going in. Confirm or refute by the end of the window.

- [ ] **CLI exit codes** : do shell wrappers / CI integrations break on the
      "warning vs blocking" distinction? Does `gf policy check` exit 1 on
      blocked policies, or does it always exit 0 with a flag?
- [ ] **MCP tool latency** : creating a decision via MCP — under 200 ms or
      noticeable lag? If lag, does Claude Code retry?
- [ ] **Multi-agent confusion** : if Claude proposes and Codex reviews on the
      *same machine* with the *same gf*, can they trample each other's state?
      The policy was that decisions are per-agent — verify.
- [ ] **Diff size handling** : a real-world refactor commit (300+ files,
      10k+ lines) — does the policy engine handle it without timing out?
      Does the cockpit UI render the diff?
- [ ] **Path traversal edge case** : `gf git attach` on a commit that touches
      a file that was symlinked outside the repo at creation time — does the
      `assert_path_in_repo` catch it?
- [ ] **FR locale completeness** : surf the FR site for 5 minutes — any
      copy that didn't get translated? Any English fallback bleeding through?
- [ ] **First-run UX** : does `gf init` explain itself? Or is the user left
      staring at an empty `.govforge/` wondering "now what"?

---

## End-of-window decision

When the window closes (1-2 weeks from start), this section answers:

- **Ship publicly?** YES / NO
- **If YES**: schedule launch date (Workstream Q execution).
- **If NO**: list of blockers + ETA. Re-open the window after fixes.
