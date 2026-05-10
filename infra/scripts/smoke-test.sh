#!/usr/bin/env bash
# Daily smoke test for govforge.dev. Cf. infra/RUNBOOK.md §1.
#
# Exit codes:
#   0 — all checks green
#   1 — at least one HTTP check failed
#   2 — a content check failed (200 OK but wrong body)
#
# Usage:
#   ./smoke-test.sh                  # human-readable output
#   ./smoke-test.sh --json           # machine-readable, one line of JSON
#
# Designed to be safe to run repeatedly from anywhere — no auth, no state.

set -uo pipefail

JSON_MODE=0
[[ "${1:-}" == "--json" ]] && JSON_MODE=1

PASS=0
FAIL=0
declare -a FAILED

check() {
    # check <name> <expected_code> <url> [grep_pattern]
    local name="$1" expected="$2" url="$3" pattern="${4:-}"
    local got body
    if [[ -n "$pattern" ]]; then
        # No -f: we want the body even on 4xx (we may be checking a 404 page)
        got="$(curl -sSL -o /tmp/smoke-body.$$ -w '%{http_code}' --max-time 10 -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' "$url" 2>/dev/null || echo "000")"
    else
        got="$(curl -so /dev/null -w '%{http_code}' --max-time 10 -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' "$url" 2>/dev/null || echo "000")"
    fi
    if [[ "$got" != "$expected" ]]; then
        ((FAIL++))
        FAILED+=("$name: expected $expected, got $got ($url)")
        [[ $JSON_MODE -eq 0 ]] && printf "  ✗ %-40s %s (expected %s)\n" "$name" "$got" "$expected"
        return
    fi
    if [[ -n "$pattern" ]] && ! grep -qE "$pattern" /tmp/smoke-body.$$ 2>/dev/null; then
        ((FAIL++))
        FAILED+=("$name: body missing pattern '$pattern' ($url)")
        [[ $JSON_MODE -eq 0 ]] && printf "  ✗ %-40s body missing /%s/\n" "$name" "$pattern"
        return
    fi
    ((PASS++))
    [[ $JSON_MODE -eq 0 ]] && printf "  ✓ %-40s %s\n" "$name" "$got"
}

check_redirect() {
    # check_redirect <name> <url> <expected_location_pattern>
    local name="$1" url="$2" expected_loc="$3"
    local result
    result="$(curl -so /dev/null -w '%{http_code} %{redirect_url}' --max-time 10 -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' "$url" 2>/dev/null)"
    local code="${result%% *}" loc="${result#* }"
    if [[ "$code" != "301" && "$code" != "302" ]]; then
        ((FAIL++))
        FAILED+=("$name: expected redirect, got $code")
        [[ $JSON_MODE -eq 0 ]] && printf "  ✗ %-40s %s (no redirect)\n" "$name" "$code"
        return
    fi
    if [[ ! "$loc" =~ $expected_loc ]]; then
        ((FAIL++))
        FAILED+=("$name: location $loc doesn't match /$expected_loc/")
        [[ $JSON_MODE -eq 0 ]] && printf "  ✗ %-40s → %s (expected /%s/)\n" "$name" "$loc" "$expected_loc"
        return
    fi
    ((PASS++))
    [[ $JSON_MODE -eq 0 ]] && printf "  ✓ %-40s %s → %s\n" "$name" "$code" "$loc"
}

[[ $JSON_MODE -eq 0 ]] && echo "GovForge smoke test — $(date -Iseconds)"

# --- Public health ---
check "apex_root_redirect"         "200" "https://govforge.dev/"               "/en/|/fr/"
check "apex_en_home"               "200" "https://govforge.dev/en/"            "Govern AI"
check "apex_fr_home"               "200" "https://govforge.dev/fr/"            "Gouvernez"
check "apex_en_pricing"            "200" "https://govforge.dev/en/pricing/"
check "apex_fr_pricing"            "200" "https://govforge.dev/fr/pricing/"
check "apex_en_press"              "200" "https://govforge.dev/en/press/"
check "apex_fr_press"              "200" "https://govforge.dev/fr/press/"

# --- Docs site ---
check "apex_en_docs_landing"       "200" "https://govforge.dev/en/docs/"
check "apex_en_docs_quickstart"    "200" "https://govforge.dev/en/docs/quickstart/"   "Quickstart"
check "apex_en_docs_cli_ref"       "200" "https://govforge.dev/en/docs/cli-reference/"
check "apex_en_docs_mcp_ref"       "200" "https://govforge.dev/en/docs/mcp-reference/"
check "apex_fr_docs_quickstart"    "200" "https://govforge.dev/fr/docs/quickstart/"   "anglais seulement"

# --- Subdomain aliases / API ---
check "api_health"                 "200" "https://api.govforge.dev/health"
check "api_swagger"                "200" "https://api.govforge.dev/docs"
check "api_openapi"                "200" "https://api.govforge.dev/openapi.json"

# --- Legacy URL redirects (anti-regression) ---
check_redirect "redir_pricing"     "https://govforge.dev/pricing"              "/en/pricing"
check_redirect "redir_docs"        "https://govforge.dev/docs"                 "/en/docs"
check_redirect "redir_docs_slug"   "https://govforge.dev/docs/cli-reference"   "/en/docs/cli-reference"
check_redirect "redir_press"       "https://govforge.dev/press"                "/en/press"
check_redirect "redir_www"         "https://www.govforge.dev/"                 "https://govforge.dev"
check_redirect "redir_docs_alias"  "https://docs.govforge.dev/"                "/en/docs"
check_redirect "redir_docs_alias_slug" "https://docs.govforge.dev/cli-reference" "/en/docs/cli-reference"

# --- SEO basics ---
check "robots_txt"                 "200" "https://govforge.dev/robots.txt"     "Sitemap.*sitemap.xml"
check "sitemap_xml"                "200" "https://govforge.dev/sitemap.xml"    "<urlset"

# --- OG / brand ---
check "og_image"                   "200" "https://govforge.dev/opengraph-image"
check "favicon_canonical"          "200" "https://govforge.dev/icon"
# /favicon.ico is rewritten by Caddy to /icon; cache-bust query bypasses any
# stale Cloudflare 404 cached from before the rewrite was deployed.
check "favicon_browser_default"    "200" "https://govforge.dev/favicon.ico?v=$(date +%s)"

# --- Custom 404 (apex) ---
check "branded_404_root"           "404" "https://govforge.dev/totallymadeup"  "Page not found · Page introuvable"
check "branded_404_locale"         "404" "https://govforge.dev/en/totallymadeup"  "Page not found · Page introuvable"

rm -f /tmp/smoke-body.$$

if [[ $JSON_MODE -eq 1 ]]; then
    printf '{"timestamp":"%s","pass":%d,"fail":%d,"failures":[%s]}\n' \
        "$(date -Iseconds)" "$PASS" "$FAIL" \
        "$(printf '"%s",' "${FAILED[@]}" | sed 's/,$//')"
else
    echo
    if [[ $FAIL -eq 0 ]]; then
        echo "✓ All $PASS checks passed."
    else
        echo "✗ $FAIL of $((PASS + FAIL)) checks FAILED:"
        for f in "${FAILED[@]}"; do
            echo "    $f"
        done
    fi
fi

[[ $FAIL -eq 0 ]] || exit 1
exit 0
