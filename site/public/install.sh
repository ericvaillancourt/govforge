#!/usr/bin/env sh
# GovForge `gf` CLI — one-liner installer.
#
#   curl -fsSL https://govforge.dev/install.sh | sh
#
# What this does:
#   - detects OS + arch
#   - resolves the latest GitHub release tag
#   - downloads gf_<version>_<os>_<arch>.tar.gz from GitHub Releases
#   - verifies the SHA-256 against checksums.txt
#   - extracts gf into ~/.local/bin (or $GOVFORGE_PREFIX/bin)
#
# Designed to be auditable: under 100 lines, no eval, no curl-piping a
# second script. Read it before piping it. Always read scripts before
# piping them.

set -eu

REPO="ericvaillancourt/govforge"
PREFIX="${GOVFORGE_PREFIX:-$HOME/.local}"
BINDIR="$PREFIX/bin"

err()  { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }
info() { printf '\033[36m==>\033[0m %s\n' "$*" >&2; }

# ---- Detect platform ----------------------------------------------------

uname_s="$(uname -s)"
case "$uname_s" in
  Linux)   os="linux" ;;
  Darwin)  os="darwin" ;;
  MINGW*|MSYS*|CYGWIN*) err "Windows detected. Download the .zip from https://github.com/$REPO/releases manually." ;;
  *)       err "unsupported OS: $uname_s" ;;
esac

uname_m="$(uname -m)"
case "$uname_m" in
  x86_64|amd64)         arch="x86_64" ;;
  arm64|aarch64)        arch="arm64" ;;
  *)                    err "unsupported arch: $uname_m" ;;
esac

# ---- Resolve latest tag -------------------------------------------------

if [ -n "${GOVFORGE_VERSION:-}" ]; then
  tag="$GOVFORGE_VERSION"
else
  info "resolving latest release"
  tag="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
    | grep -o '"tag_name": *"[^"]*"' \
    | head -n 1 \
    | cut -d'"' -f4)"
  [ -n "$tag" ] || err "could not resolve latest release tag"
fi
version="${tag#v}"

archive="gf_${version}_${os}_${arch}.tar.gz"
url="https://github.com/$REPO/releases/download/$tag/$archive"
checksums_url="https://github.com/$REPO/releases/download/$tag/checksums.txt"

# ---- Download + verify --------------------------------------------------

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

info "downloading $archive"
curl -fsSL -o "$tmp/$archive" "$url" || err "download failed: $url"

info "downloading checksums.txt"
curl -fsSL -o "$tmp/checksums.txt" "$checksums_url" || err "checksums download failed"

info "verifying sha-256"
expected="$(grep "  $archive\$" "$tmp/checksums.txt" | awk '{print $1}')"
[ -n "$expected" ] || err "$archive not present in checksums.txt"

if command -v sha256sum >/dev/null 2>&1; then
  actual="$(sha256sum "$tmp/$archive" | awk '{print $1}')"
elif command -v shasum >/dev/null 2>&1; then
  actual="$(shasum -a 256 "$tmp/$archive" | awk '{print $1}')"
else
  err "no sha256sum or shasum on PATH"
fi
[ "$actual" = "$expected" ] || err "checksum mismatch: expected $expected got $actual"

# ---- Install ------------------------------------------------------------

mkdir -p "$BINDIR"
info "extracting to $BINDIR"
tar -xzf "$tmp/$archive" -C "$tmp" gf
mv "$tmp/gf" "$BINDIR/gf"
chmod +x "$BINDIR/gf"

# ---- Final note ---------------------------------------------------------

info "installed: $BINDIR/gf ($tag)"
case ":$PATH:" in
  *:"$BINDIR":*) ;;
  *)
    cat <<EOF
Add $BINDIR to PATH:

  export PATH="\$PATH:$BINDIR"

(append to ~/.bashrc or ~/.zshrc)
EOF
    ;;
esac

"$BINDIR/gf" version 2>/dev/null || true
