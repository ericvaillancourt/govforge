# Demo Video — 105-second cut

> **Goal**: a viewer who knows nothing about MCP / AI agents understands
> what GovForge does within 30 seconds, and watches the human-approval
> beat at the end. Anything that doesn't push toward that goal gets cut.

## Format

- **Length**: 105 s (target). Hard ceiling 120 s. Below 90 s feels rushed.
- **Aspect ratio**: 16:9 1080p. Vertical 9:16 cut later for X/LinkedIn.
- **Audio**: voiceover (English, neutral mid-Atlantic accent). No music
  bed under the demo terminal — it competes with the typing rhythm.
  10-second ambient pad at intro + outro only.
- **On-screen text**: section markers in lower-third, large enough on
  mobile (24 pt+).
- **Cursor / scroll motion**: smooth. Use `gif-pal-2` or `terminalizer`
  with smooth-scroll if recording from a real terminal feels jittery.

## Cold open (0:00 – 0:08, 8 s)

**Visual**: dark terminal. Blank. A line types:

```text
$ claude write me a session-auth refactor
```

**VO**: *"Your AI agent just rewrote your authentication code."*

**Beat**: terminal scrolls fast through a 30-line diff (auth.py,
middleware/session.py). The diff blurs as it scrolls — it's
intentionally illegible. Stops on the prompt.

**VO continues**: *"Did anyone read it?"*

## Problem framing (0:08 – 0:25, 17 s)

**Visual**: cut to a screen split in two. Left: a Claude Code chat
window with a confident "Done. The auth migration is committed."
Right: an empty PR description.

**VO**: *"AI agents now ship migrations, refactors, and architecture
decisions. The repo only sees the diff. The why — and the risk —
disappears the moment the IDE tab closes."*

**Visual end**: text overlay fades in: *"We need a record."*

## Solution intro (0:25 – 0:35, 10 s)

**Visual**: brand mark fades in centered. Wordmark "GovForge"
crystallises beside it.

**VO**: *"GovForge is the audit layer for AI coding agents."*

**Visual end**: tagline materialises:
*"Govern AI coding agents before they govern your codebase."*

## Workflow demo (0:35 – 1:25, 50 s)

**Visual**: full-screen terminal, dark theme. Each step is a single
command + 2-3 lines of output. Pause 0.7 s between steps so the viewer
can read.

```text
$ gf init
Initialized GovForge project at /home/me/repo/.govforge
```

**VO**: *"One command initializes governance in any repo — locally."*

```text
$ gf task create --title "Migrate auth to signed cookies" --risk high
TASK-001 created
```

**VO**: *"Tasks come in. Claude proposes a decision."*

```text
$ gf decision create --task TASK-001 --author claude --title "Migrate to signed cookies" --risk high
DEC-001 created
```

```text
$ gf git attach --decision DEC-001
DEC-001  abc123  auth.py +84 -31
```

**VO**: *"The diff is attached as evidence."*

```text
$ gf policy check --decision DEC-001
BLOCKED  auth_change_requires_review
PASSED   secret_pattern_detection
PASSED   test_required_for_high_risk
```

**VO**: *"Policies run automatically. The auth-change rule blocks
this until a review is recorded."*

```text
$ gf review request --decision DEC-001 --reviewer codex
review requested → codex
```

**Visual**: cut to a second terminal pane appearing on the right:
Codex's view. A Codex prompt arrives, the agent replies with a finding.

```text
codex submitted REV-001 → changes_requested
  high  security  middleware/session.py
        Session token is not rotated after login.
```

**VO**: *"Codex reviews and pushes back. The disagreement is captured
as a structured object — not a chat message that disappears."*

```text
$ gf approve DEC-001 --comment "OK after rotation patch"
DEC-001 approved
```

**VO**: *"And nothing merges without an explicit human approval."*

## Cockpit pivot (1:25 – 1:40, 15 s)

**Visual**: cut to the cockpit at `localhost:8788/decisions/DEC-001`.
Cursor walks the page top-to-bottom: title + risk badge → Git change
panel → policy results → review with the finding → approval card →
the timeline on the right shows every event.

**VO**: *"Every decision becomes an audit-ready record. Diff, policy
results, peer review, human gate — all in one place."*

## Close (1:40 – 1:45, 5 s)

**Visual**: brand mark + URL.

**VO**: *"Open source. Apache 2.0. Local-first. govforge.dev."*

**Visual end**: a single line of text:

```text
$ pipx install govforge && curl -fsSL https://govforge.dev/install.sh | sh
```

## Recording recipe

```bash
# 1. Start the backend
gf api serve > /tmp/api.log 2>&1 &

# 2. Reset state for a clean cast
rm -rf .govforge && gf init && curl -sS -X POST http://127.0.0.1:8787/projects \
  -H 'Content-Type: application/json' \
  -d '{"name":"demo","root_path":"'"$(pwd)"'"}'

# 3. Record the workflow steps using terminalizer or asciinema
terminalizer record demo --config marketing/video/terminalizer.yaml
# (or)
asciinema rec marketing/video/raw-cast.cast

# 4. Run the script in marketing/asciinema/cast-script.md
```

## Voiceover script (raw)

```
[0:00] Your AI agent just rewrote your authentication code.
       Did anyone read it?

[0:08] AI agents now ship migrations, refactors, and architecture
       decisions. The repo only sees the diff. The why — and the
       risk — disappears the moment the IDE tab closes.

[0:25] GovForge is the audit layer for AI coding agents.

[0:35] One command initializes governance in any repo — locally.
       Tasks come in. Claude proposes a decision.
       The diff is attached as evidence.
       Policies run automatically. The auth-change rule blocks this
         until a review is recorded.
       Codex reviews and pushes back. The disagreement is captured as
         a structured object — not a chat message that disappears.
       And nothing merges without an explicit human approval.

[1:25] Every decision becomes an audit-ready record. Diff, policy
       results, peer review, human gate — all in one place.

[1:40] Open source. Apache 2.0. Local-first. govforge.dev.
```

## What we deliberately don't show

- MCP wiring (config files, agent setup) — too platform-specific for
  a 90-s cut. Linked from the description.
- Pricing or enterprise tiers — wrong tone for the launch demo.
- Comparison with Cursor/Copilot — invites an argument we don't need.
- Code examples of policy authoring — interesting but slows the pace.
  Belongs in a follow-up "How it works under the hood" video.

## Thumbnail / poster frame

Final still: brand mark on left, terminal showing the timeline panel
on right (`gf decision timeline DEC-001` output with
`decision.created`, `decision.policy_evaluated`, `review.submitted`,
`decision.approved` rows). Caption: "From AI prompt to audit trail
in one minute."
