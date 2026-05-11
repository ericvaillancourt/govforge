# Quickstart

Five minutes from clone to your first audited decision. For the full
walkthrough — the Claude → Codex → human-approval scenario — read
[`workflow-example.md`](workflow-example.md).

## Prerequisites

- **Go 1.22+** for the `gf` CLI
- **Python 3.12+** for the backend
- **Git** in your `PATH`
- A repository to govern (any Git working tree)

No cgo, no native libraries, no Docker required.

## 1. Build

```bash
git clone https://github.com/ericvaillancourt/govforge
cd govforge
cd cli && go build -o ~/bin/gf ./cmd/gf
cd ../backend && pip install -e .
```

Add `~/bin` to your `PATH` if it isn't already, then verify:

```bash
gf --version
```

## 2. Initialize a project

```bash
cd ~/your/repo
gf init
```

`gf init` is autonomous — it embeds the SQL schema and applies it via
the pure-Go SQLite driver. No backend required. You should see:

```text
Initialized GovForge project at /home/me/your/repo/.govforge
  config:   /home/me/your/repo/.govforge/config.toml
  policies: /home/me/your/repo/.govforge/policies.toml
  database: /home/me/your/repo/.govforge/govforge.db

Next: `gf api serve` to start the local HTTP API.
```

## 3. Start the backend

```bash
gf api serve &
```

Spawns the FastAPI HTTP server on `127.0.0.1:8787`. In another shell:

```bash
gf project status
```

```text
Project
path: /home/me/your/repo
database: /home/me/your/repo/.govforge/govforge.db
api url: http://127.0.0.1:8787
api: ok — backend 0.1.0
```

> **Authentication.** Phase 3.0 Stage A made every write endpoint require
> `Authorization: Bearer <token>`. For `gf init` against your own local
> backend, the bootstrap is automatic: `gf init` provisions a default
> user + admin token in `.govforge/auth.toml`, and every `gf` command
> reads from there. For the **hosted** backend at `api.govforge.dev`,
> the fastest path is:
>
>     gf auth login --device
>
> The CLI prints a short code + URL; open the URL in your browser,
> sign in (GitHub or Google), enter the code, click Authorize — the
> CLI receives the issued token automatically and writes it to
> `.govforge/auth.toml`. If you prefer the manual path, you can also
> create a token from <https://govforge.dev/en/account/> and run
> `gf auth login --token gfp_…`. `GOVFORGE_API_TOKEN` works as an
> env-var override on both paths. See
> [`infra/RUNBOOK.md` §8](https://github.com/ericvaillancourt/govforge/blob/main/infra/RUNBOOK.md)
> for the operator-side runbook.

## 4. Register the project

Phase 1 needs one manual `POST /projects` after `gf init`. Phase 2 will
fold this into `gf init`.

```bash
TOKEN=$(jq -r .admin_token .govforge/auth.toml)
curl -sS -X POST http://127.0.0.1:8787/projects \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"my-repo","root_path":"'"$(pwd)"'"}' | jq
```

## 5. Walk through a decision

```bash
gf task create --title "Refactor auth" --risk high --actor claude
gf decision create \
  --task TASK-001 \
  --author claude \
  --title "Migrate to signed cookies" \
  --risk high
gf git attach --decision DEC-001 --commit HEAD
gf policy check --decision DEC-001
gf review request --decision DEC-001 --reviewer codex
gf approve DEC-001 --comment "OK after rotation patch"
gf decision timeline DEC-001
```

The final timeline shows every step the agents and the human took:

```text
╭─────────────────────┬──────────┬───────────────────────────╮
│ AT                  │ ENTITY   │ EVENT                     │
├─────────────────────┼──────────┼───────────────────────────┤
│ 2026-05-10 14:02:11 │ decision │ decision.created          │
│ 2026-05-10 14:03:45 │ decision │ decision.git_attached     │
│ 2026-05-10 14:03:46 │ decision │ decision.policy_evaluated │
│ 2026-05-10 14:03:46 │ decision │ decision.status_changed   │
│ 2026-05-10 14:05:12 │ decision │ review.requested          │
│ 2026-05-10 14:18:55 │ decision │ decision.approved         │
╰─────────────────────┴──────────┴───────────────────────────╯
```

## 6. Open the cockpit

```bash
cd ~/path/to/govforge/ui
npm ci
npm run dev      # http://localhost:8788
```

Pick the project in the top-right switcher; click into `DEC-001`. You
should see the summary, the Git change panel, the policy results,
the review (once Codex submits one), and the approval.

## Next steps

- Wire an MCP-capable agent to your project — see
  [`mcp-integration.md`](mcp-integration.md).
- Read the full Claude → Codex → human-approval workflow in
  [`workflow-example.md`](workflow-example.md).
- Tune or add policies — see [`configuration.md`](configuration.md) and
  [`policy-authoring.md`](policy-authoring.md).
- Curious about the security guarantees? Every claim in
  [`threat-model.md`](threat-model.md) points at the test that pins it.
