# Asciinema Cast — Install + Quickstart

The asciinema cast is the README hero asset. Embedded via
`asciinema-player` on `govforge.dev` and on the GitHub repo (the v3
asciinema GIF preview renders inline).

## Goal

Show a **viewer who has never run GovForge** that they can be looking
at an audit timeline within ~90 seconds. The cast is the proof of the
"30-second install + 5-minute workflow" claim on the marketing site.

## Setup before recording

```bash
# 0. Tools you need (one-time, on the recording host)
pipx install asciinema       # the recorder itself
npm i -g asciinema-edit      # for tightening idle pauses (optional but recommended)
# asciicast2gif is needed only for the GIF preview — see "Publishing".

# 1. Clean state — temp dir + temp shell
WORKDIR="$(mktemp -d)/demo-repo"
mkdir -p "$WORKDIR" && cd "$WORKDIR"
git init -q && git commit -q --allow-empty -m "initial"

# 2. Optional: pre-warm the binaries so download time doesn't show
test -x ~/bin/gf || (cd /path/to/govforge/cli && go build -o ~/bin/gf ./cmd/gf)
pip show govforge > /dev/null || (cd /path/to/govforge/backend && pip install -e .)

# 3. Use a clean shell prompt (no two-line PS1, no git status indicators)
export PS1='$ '

# 4. Set asciinema font + idle compression
export ASCIINEMA_REC_OPTS="--idle-time-limit=2 --command='/bin/bash --norc'"
```

## Recording

```bash
asciinema rec marketing/asciinema/quickstart.cast \
  --title "GovForge — quickstart" \
  --idle-time-limit 1.5 \
  --rows 20 --cols 100
```

Then run the script below. **Type at human speed** (4–6 chars/sec).
asciinema captures real timing — too fast feels suspicious, too slow
loses the viewer.

## Script

Each line is one shell command. Pause ~1 s between commands. Pause
~3 s after each section header is shown (the viewer needs to read).

```bash
# ── 1. Install (≤ 8 s)
$ curl -fsSL https://govforge.dev/install.sh | sh
==> resolving latest release
==> downloading gf_0.1.0_linux_x86_64.tar.gz
==> verifying sha-256
==> installed: ~/.local/bin/gf (v0.1.0)

$ pipx install govforge
  installed package govforge 0.1.0

# ── 2. Init (≤ 5 s)
$ cd ~/your/repo
$ gf init
Initialized GovForge project at /home/me/your/repo/.govforge
  config:   .govforge/config.toml
  policies: .govforge/policies.toml
  database: .govforge/govforge.db

Next: `gf api serve` to start the local HTTP API.

# ── 3. Backend (≤ 4 s — shown briefly, then fades to background)
$ gf api serve &
[gov]forge api on http://127.0.0.1:8787

$ gf project status
Project
path:     /home/me/your/repo
api url:  http://127.0.0.1:8787
api:      ok — backend 0.1.0

# ── 4. The workflow (≤ 60 s, the meat of the cast)
$ gf task create --title "Migrate auth to signed cookies" --risk high --actor claude
Task created
id:     TASK-001
risk:   high
status: open

$ gf decision create --task TASK-001 --author claude \
    --title "Migrate session auth" --risk high
Decision created
id:     DEC-001
risk:   high
status: draft

$ gf git attach --decision DEC-001 --commit HEAD --actor claude
Git change attached
decision: DEC-001
commit:   abc123def456
files:    auth.py, middleware/session.py
+:        84   -:   31

$ gf policy check --decision DEC-001
╭──────────────────────────────────────┬─────────┬─────────────────────────────────────────────────────╮
│ POLICY                               │ STATUS  │ MESSAGE                                             │
├──────────────────────────────────────┼─────────┼─────────────────────────────────────────────────────┤
│ auth_change_requires_review          │ blocked │ 1 auth-adjacent file(s) modified — review required. │
│ secret_pattern_detection             │ passed  │ No secret patterns detected.                        │
│ test_required_for_high_risk          │ passed  │ 1 test file(s) modified.                            │
│ migration_requires_review            │ passed  │ No migration files touched.                         │
│ large_diff_requires_human_approval   │ passed  │ Diff size 115 within threshold (500).               │
╰──────────────────────────────────────┴─────────┴─────────────────────────────────────────────────────╯

$ gf review request --decision DEC-001 --reviewer codex --focus security,tests
Review requested
decision:  DEC-001
reviewer:  codex
status:    review_required

# (For the cast we simulate Codex's response with a curl — agents do this via MCP.)
$ curl -sS -X POST http://127.0.0.1:8787/reviews -H 'Content-Type: application/json' -d '{
    "decision_id":"DEC-001","reviewer_agent":"codex","status":"changes_requested",
    "summary":"Session fixation risk",
    "findings":[{"severity":"high","category":"security",
                 "file_path":"middleware/session.py",
                 "message":"Token not rotated after login",
                 "recommendation":"Rotate session token after successful login"}]
  }' | jq -r '.display_id + " " + .status'
REV-001 changes_requested

$ gf approve DEC-001 --comment "Approved after rotation patch"
Decision DEC-001
status:  approved
comment: Approved after rotation patch

# ── 5. The audit trail (the moneyshot)
$ gf decision timeline DEC-001
╭─────────────────────┬──────────┬───────────────────────────╮
│ AT                  │ ENTITY   │ EVENT                     │
├─────────────────────┼──────────┼───────────────────────────┤
│ 2026-05-10 14:02:11 │ decision │ decision.created          │
│ 2026-05-10 14:03:45 │ decision │ decision.git_attached     │
│ 2026-05-10 14:03:46 │ decision │ decision.policy_evaluated │
│ 2026-05-10 14:03:46 │ decision │ decision.status_changed   │
│ 2026-05-10 14:05:12 │ decision │ review.requested          │
│ 2026-05-10 14:08:33 │ decision │ review.submitted          │
│ 2026-05-10 14:08:33 │ decision │ decision.status_changed   │
│ 2026-05-10 14:18:55 │ decision │ decision.approved         │
╰─────────────────────┴──────────┴───────────────────────────╯
```

End the cast on the timeline. **Don't kill the API server** in the
recording — leaves a clean exit.

## Post-processing

```bash
# Trim the head/tail (asciinema sometimes captures setup chatter)
asciinema cat quickstart.cast | head -n 5     # eyeball

# Tighten idle gaps over 2.5 s to 1.5 s for a snappier feel
asciinema-edit speed --start-pause-threshold 2.5 \
                     --end-pause-threshold 2.5 \
                     --factor 0.6 \
                     quickstart.cast > quickstart.tight.cast
```

## Publishing

```bash
# 1. Upload to asciinema.org for the embed URL
asciinema upload quickstart.tight.cast
# → https://asciinema.org/a/<id>

# 2. Generate the static GIF preview for the README hero.
#    Podman works the same as Docker here — pick either.
podman run --rm -v "$PWD:/data:Z" asciinema/asciicast2gif \
  /data/quickstart.tight.cast /data/quickstart.gif

# 3. Drop the .cast and .gif into site/public/quickstart/ (create the dir
#    on first run; the deploy rsync picks it up automatically).
mkdir -p site/public/quickstart
mv quickstart.tight.cast quickstart.gif site/public/quickstart/
```

The README hero embeds:

```html
<a href="https://asciinema.org/a/<id>" target="_blank">
  <img src="site/public/quickstart/quickstart.gif"
       alt="GovForge quickstart cast" width="800">
</a>
```

## Notes

- **No real secrets, no real API keys.** The cast goes on a public
  asciinema page. Use a throwaway repo path; redact `~/your/repo` to
  literally `~/your/repo`.
- **Don't show `~/.bashrc`-specific aliases.** Use a vanilla shell so
  viewers can reproduce verbatim.
- **The `curl` to `/reviews` is a simulation prop.** In a real workflow
  the agent calls the MCP `submit_review` tool. We use curl in the cast
  because the MCP transport is invisible to the terminal viewer; we
  call it out in the script note.
