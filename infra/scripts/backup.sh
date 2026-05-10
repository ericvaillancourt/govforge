#!/usr/bin/env bash
# Weekly backup of GovForge ops state to Cloudflare R2 via restic.
#
# Run by govforge-backup.timer (systemd user unit, weekly).
# Reads R2 + restic credentials from ~/.config/govforge-ops/.env (chmod 600).
#
# Backed up:
#   ~/govforge/caddy/         — Caddyfile (the only stateful config)
#   ~/govforge/site/out/      — current site build (rebuildable, but cheap)
#   podman volume govforge-caddy-data    — Caddy state (issued certs etc.)
#   podman volume govforge-caddy-config  — Caddy auto-generated config
#
# NOT backed up:
#   - The repo (it's on GitHub)
#   - SQLite local DBs (those are user data, not ops data)
#   - Container images (re-pulled from registry)
#
# Verification: see infra/RUNBOOK.md §3 "Restore drill".

set -Eeuo pipefail

ENV_FILE="${HOME}/.config/govforge-ops/.env"
if [[ ! -r "$ENV_FILE" ]]; then
    echo "FATAL: $ENV_FILE not readable. See infra/RUNBOOK.md §3." >&2
    exit 1
fi

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

: "${R2_ACCOUNT_ID:?required}"
: "${R2_ACCESS_KEY_ID:?required}"
: "${R2_SECRET_ACCESS_KEY:?required}"
: "${R2_BUCKET:?required}"
: "${RESTIC_PASSWORD:?required}"

export RESTIC_REPOSITORY="s3:https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}"
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"

WORK_DIR="$(mktemp -d -t govforge-backup-XXXXXX)"
trap 'rm -rf "$WORK_DIR"' EXIT

echo "[$(date -Iseconds)] govforge backup starting"

# Export podman volumes to tarballs (restic dedupes them efficiently).
for vol in govforge-caddy-data govforge-caddy-config; do
    if podman volume inspect "$vol" >/dev/null 2>&1; then
        echo "  exporting volume: $vol"
        podman volume export "$vol" >"$WORK_DIR/${vol}.tar"
    else
        echo "  skipping volume $vol (not present)"
    fi
done

# Backup paths: caddy config dir + exported volumes + site/out.
restic backup \
    --tag govforge \
    --tag "host=$(hostname)" \
    "$HOME/govforge/caddy" \
    "$HOME/govforge/site/out" \
    "$WORK_DIR"

# Retention: keep 4 weekly + 6 monthly + 2 yearly snapshots.
restic forget \
    --keep-weekly 4 \
    --keep-monthly 6 \
    --keep-yearly 2 \
    --prune

# Quick integrity check on a 5% sample (full check is monthly via cron).
restic check --read-data-subset=5%

echo "[$(date -Iseconds)] govforge backup done"
