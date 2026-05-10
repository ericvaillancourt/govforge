# GovForge Ops Runbook

> Self-hosted production ops for `govforge.dev`. Hypervisor 2 = `192.168.2.5`,
> rootless Podman, Caddy file_server, Cloudflare Tunnel via `.4`.
> No secrets in this file — see `infra/.env.example` for the variables you set
> in `~/.config/govforge-ops/.env` on the deploy host.

---

## Quick reference

| What | Where | Command |
|---|---|---|
| Site files | `192.168.2.5:~/govforge/site/out/` | `rsync -av --delete out/ eric@192.168.2.5:~/govforge/site/out/` |
| Caddyfile | `192.168.2.5:~/govforge/caddy/Caddyfile` | `rsync -av infra/caddy/Caddyfile eric@192.168.2.5:~/govforge/caddy/Caddyfile` |
| Caddy service | systemd user unit | `systemctl --user {status,restart} govforge-caddy.service` |
| Backend (FastAPI) | systemd user unit | `systemctl --user {status,restart} govforge-backend.service` |
| Caddy logs | journald (per-user) | `journalctl --user -u govforge-caddy.service -f` |
| Backend logs | journald (per-user) | `journalctl --user -u govforge-backend.service -f` |
| Containers | podman | `podman ps`, `podman stats` |
| Health endpoint | local | `curl http://192.168.2.5:8080/healthz` |

---

## 1. Daily checks (≤ 30 s)

```bash
# All systemd user units green?
ssh eric@192.168.2.5 'systemctl --user list-units "govforge-*" --state=failed'
# (empty output = good)

# Public health
curl -sI https://govforge.dev/ | head -1            # 200
curl -sI https://api.govforge.dev/health | head -1   # 200
curl -sI https://docs.govforge.dev/ | head -1        # 301

# Container memory pressure
ssh eric@192.168.2.5 'podman stats --no-stream'
```

---

## 2. SSH hardening — disable password auth

> **Lockout risk.** Test from a second terminal AFTER reload, BEFORE closing
> the original session.

### Pre-flight

```bash
# 1. Confirm your key is in authorized_keys on .5
ssh -o BatchMode=yes eric@192.168.2.5 'cat ~/.ssh/authorized_keys | wc -l'  # ≥ 1

# 2. Confirm root's password is rotated (the original deploy used a temp pwd)
ssh eric@192.168.2.5 'sudo passwd -S eric'  # P or PS, not NP / L
```

### Apply

```bash
ssh eric@192.168.2.5

# Edit sshd_config — flip PasswordAuthentication to no, KbdInteractive to no
sudo sed -i.bak \
  -e 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' \
  -e 's/^#*KbdInteractiveAuthentication.*/KbdInteractiveAuthentication no/' \
  -e 's/^#*ChallengeResponseAuthentication.*/ChallengeResponseAuthentication no/' \
  /etc/ssh/sshd_config

# Validate config (returns nothing on success)
sudo sshd -t

# Reload (NOT restart — reload preserves existing sessions)
sudo systemctl reload ssh
```

### Verify (from a SECOND terminal — keep first one open!)

```bash
ssh eric@192.168.2.5 echo ok                # should connect via key
ssh -o PubkeyAuthentication=no eric@192.168.2.5  # should be denied
```

### Rollback

```bash
sudo cp /etc/ssh/sshd_config.bak /etc/ssh/sshd_config
sudo systemctl reload ssh
```

---

## 3. Backups — restic to Cloudflare R2

### One-time setup (on `.5`)

1. Create R2 bucket `govforge-backups` in Cloudflare dashboard.
2. Create R2 API token with `Object Read & Write` scope on that bucket only.
3. Save credentials in `~/.config/govforge-ops/.env` (chmod 600):

   ```
   R2_ACCOUNT_ID=...
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_BUCKET=govforge-backups
   RESTIC_PASSWORD=<long random string — NOT the R2 secret>
   ```

4. Initialize the restic repo (only once, ever):

   ```bash
   set -a; source ~/.config/govforge-ops/.env; set +a
   export RESTIC_REPOSITORY="s3:https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}"
   export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
   export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
   restic init
   ```

5. Install the timer (runs `infra/scripts/backup.sh` weekly):

   ```bash
   cp infra/podman/quadlet/govforge-backup.{service,timer} \
      ~/.config/systemd/user/
   systemctl --user daemon-reload
   systemctl --user enable --now govforge-backup.timer
   systemctl --user list-timers govforge-backup.timer  # confirm next run
   ```

### Manual backup

```bash
~/govforge/scripts/backup.sh
# logs to journalctl --user -u govforge-backup.service
```

### Restore drill (monthly)

```bash
# 1. List snapshots
restic snapshots

# 2. Restore latest to a scratch dir (NOT to live paths)
mkdir -p /tmp/restore-test
restic restore latest --target /tmp/restore-test

# 3. Smoke test: spot-check Caddyfile + a few site assets
diff /tmp/restore-test/govforge/caddy/Caddyfile ~/govforge/caddy/Caddyfile
ls /tmp/restore-test/govforge/site/out/en/docs/ | wc -l  # ≥ 13

# 4. Cleanup
rm -rf /tmp/restore-test
```

Document the date + outcome at the bottom of this file under "Restore drills".

---

## 4. Uptime monitoring — UptimeRobot

> Free tier: 50 monitors, 5 min interval. Plenty for our 3 hosts.

### Setup

1. Create account at uptimerobot.com (one-time).
2. Add 3 HTTP(s) monitors:
   - `https://govforge.dev/` → expect 200
   - `https://api.govforge.dev/health` → expect 200
   - `https://docs.govforge.dev/` → expect 200 OR 301 (alias)
3. Alert contacts: email to `eric.vaillancourt@talsom.com` + (optional) Telegram bot.
4. Maintenance window: never (we don't take the site down on schedule).

### When you get paged

| Symptom | First check |
|---|---|
| All 3 down | Cloudflare status page → tunnel on `.4` (`systemctl status cloudflared-machiavel.service`) |
| `govforge.dev` down, others OK | Caddy on `.5` (`systemctl --user status govforge-caddy.service`) |
| `api.govforge.dev` down | Backend container on `.5` (`systemctl --user status govforge-backend.service`) |
| 5xx loop | journald: `journalctl --user -u govforge-{caddy,backend}.service --since '5 min ago'` |

---

## 5. Common incidents

### 5.1 Site renders English on `/fr/`

The dictionary fell out of sync. Rebuild + redeploy:

```bash
cd site && rm -rf .next out && npx next build
rsync -av --delete out/ eric@192.168.2.5:~/govforge/site/out/
```

### 5.2 Caddy returns 502 for `api.govforge.dev`

Backend container is down. Check + restart:

```bash
ssh eric@192.168.2.5 'systemctl --user status govforge-backend.service'
ssh eric@192.168.2.5 'systemctl --user restart govforge-backend.service'
```

### 5.3 OG image renders broken on Twitter / LinkedIn

Caddy needs to set `Content-Type: image/png` for extensionless `/icon`,
`/apple-icon`, `/opengraph-image`. Already wired in `Caddyfile @brand_images`
— if broken after a Caddyfile edit, search for that block and confirm it's
present.

### 5.4 Legacy URL returns 404 (`govforge.dev/pricing`, `/docs/cli-reference`)

The `@legacy_pricing` / `@legacy_docs` / `@legacy_press` blocks must be
present in `Caddyfile` and listed BEFORE `try_files` inside `handle @apex`.
The redirects are 301 to `/en{uri}`.

### 5.5 Disk full on `.5`

```bash
ssh eric@192.168.2.5 'df -h /; podman system df'
# Common culprit: container logs in journald. Trim:
sudo journalctl --vacuum-time=14d
# Or images:
podman image prune -a
```

---

## 6. Secrets management

| Secret | Where it lives | Rotation cadence |
|---|---|---|
| R2 API token | `~/.config/govforge-ops/.env` on `.5`, chmod 600 | 12 months |
| `RESTIC_PASSWORD` | same file | Never auto-rotate (would invalidate the repo) — write down the value somewhere offline; losing it means losing all backups |
| GitHub PAT (CI) | GitHub repo Secrets | 6 months |
| Stripe keys (Phase 3.1) | TBD — likely 1Password vault + backend env var | 12 months |
| SSH private key | `~/.ssh/id_ed25519` on Eric's laptop | 24 months |

---

## 7. Restore drills (log)

Append after each monthly drill. Format:

```
- 2026-MM-DD — restored snapshot <id> to /tmp — Caddyfile + 13 docs OK
```

(none yet — first drill due 2026-06-10)
