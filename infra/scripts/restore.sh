#!/usr/bin/env bash
# Restore drill helper — companion to backup.sh.
#
# Uses the SAME env file (~/.config/govforge-ops/.env) and the same
# environment-variable override semantics (set `RESTIC_REPOSITORY`
# directly to point at a non-R2 backend, used by the CI smoke).
#
# Usage:
#   restore.sh [--snapshot latest|ID]
#              [--target DIR]
#              [--verify]
#              [--cleanup]
#
# `--verify` runs a minimum-viable invariant check on the restored tree:
#   - a non-empty Caddyfile is present somewhere under TARGET
#   - the site export under en/docs/ contains at least 13 index.html files
#     (matches the docs/ count audited in CHANGELOG)
# Exits non-zero if any check fails — wrap this in the monthly drill cron.
#
# `--cleanup` rm -rf's the target on success. Use it for unattended drills.
# Default target is a fresh /tmp/govforge-restore-XXXXXX so you can poke
# around manually.

set -Eeuo pipefail

SNAPSHOT="latest"
TARGET=""
VERIFY=false
CLEANUP=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --snapshot) SNAPSHOT="${2:?--snapshot needs an arg}"; shift 2 ;;
        --target)   TARGET="${2:?--target needs an arg}";     shift 2 ;;
        --verify)   VERIFY=true;  shift ;;
        --cleanup)  CLEANUP=true; shift ;;
        -h|--help)
            sed -n '2,28p' "$0" | sed 's/^# \?//'
            exit 0
            ;;
        *) echo "unknown argument: $1" >&2; exit 2 ;;
    esac
done

[[ -z "$TARGET" ]] && TARGET="$(mktemp -d -t govforge-restore-XXXXXX)"

# Same env-loading rules as backup.sh — env file required UNLESS the
# caller has pre-set RESTIC_REPOSITORY (CI roundtrip path).
ENV_FILE="${HOME}/.config/govforge-ops/.env"
if [[ -r "$ENV_FILE" ]]; then
    # shellcheck disable=SC1090
    set -a; source "$ENV_FILE"; set +a
elif [[ -z "${RESTIC_REPOSITORY:-}" ]]; then
    echo "FATAL: $ENV_FILE not readable and \$RESTIC_REPOSITORY not preset. See infra/RUNBOOK.md §3." >&2
    exit 1
fi

if [[ -z "${RESTIC_REPOSITORY:-}" ]]; then
    : "${R2_ACCOUNT_ID:?required}"
    : "${R2_ACCESS_KEY_ID:?required}"
    : "${R2_SECRET_ACCESS_KEY:?required}"
    : "${R2_BUCKET:?required}"
    export RESTIC_REPOSITORY="s3:https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}"
    export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
    export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
fi

: "${RESTIC_PASSWORD:?required}"

echo "[$(date -Iseconds)] restoring snapshot=$SNAPSHOT target=$TARGET"
restic restore "$SNAPSHOT" --target "$TARGET"

if $VERIFY; then
    fail=0

    # Caddyfile invariant — restic preserves absolute paths, so the file
    # ends up at $TARGET/$HOME/govforge/caddy/Caddyfile. `find` keeps the
    # check host-agnostic (the snapshot may have been taken under a
    # different $HOME than the current process).
    if find "$TARGET" -type f -name Caddyfile -size +0c 2>/dev/null | grep -q .; then
        echo "  [ok] Caddyfile present and non-empty"
    else
        echo "  [FAIL] no non-empty Caddyfile under $TARGET" >&2
        fail=1
    fi

    # Site export — count the per-doc index.html files. We bumped to 14
    # mermaid-aware docs in May 2026; assert >=13 to stay forward-compatible.
    doc_count=$(find "$TARGET" -path '*/site/out/en/docs/*/index.html' 2>/dev/null | wc -l)
    if [[ "$doc_count" -ge 13 ]]; then
        echo "  [ok] $doc_count en/docs pages restored"
    else
        echo "  [FAIL] only $doc_count en/docs pages restored (expected >=13)" >&2
        fail=1
    fi

    # Volume tarballs — warning only, the snapshot may pre-date the
    # quadlet rollout on a particular host.
    if find "$TARGET" -type f -name 'govforge-caddy-*.tar' 2>/dev/null | grep -q .; then
        echo "  [ok] caddy volume tarballs present"
    else
        echo "  [warn] no caddy volume tarballs in this snapshot"
    fi

    if (( fail != 0 )); then
        exit 1
    fi
fi

if $CLEANUP; then
    rm -rf "$TARGET"
fi

echo "[$(date -Iseconds)] restore done"
