# Security Policy

GovForge is **governance plumbing** — its job is to keep AI coding agents
honest about the changes they make. A vulnerability here can let an
attacker bypass an audit trail, smuggle a malicious tool into an MCP
client, or escape the read-only Git contract. We take it seriously.

## Reporting a vulnerability

**Please do not open a public GitHub issue for a security report.**

Use one of:

- **Email**: [security@govforge.dev](mailto:security@govforge.dev)
- **GitHub Security Advisory**: [Open a private advisory](https://github.com/ericvaillancourt/govforge/security/advisories/new)

Include, when you can:

- the affected component (backend MCP / API / Git extractor / CLI / UI);
- the version or commit SHA you tested against;
- a minimal reproduction (commands or a small script);
- the impact you believe the issue has;
- any mitigations you've already worked around.

Encrypted reports: GPG key fingerprint will be published at
[`https://govforge.dev/.well-known/security.txt`](https://govforge.dev/.well-known/security.txt)
once the first signed release ships.

## What to expect

- **Acknowledgement** within 72 hours.
- **Triage** within 7 days. We'll reproduce, classify severity, and
  share an initial timeline.
- **Fix** target — Critical: 14 days · High: 30 days · Medium: 90 days.
  These are intent, not promises. We'll keep you in the loop if a
  specific fix needs longer.
- **Disclosure** is coordinated. We prefer to ship the fix first, then
  publish the advisory with credit to you (unless you'd rather stay
  anonymous). 90-day disclosure is the upper bound — earlier if a fix
  ships sooner.

## Supported versions

GovForge is **pre-1.0**. Until the first stable release we only support
the `main` branch. After 1.0:

| Branch | Supported     |
|--------|---------------|
| `main` | ✅ always     |
| `1.x`  | ✅ until `2.0` (security fixes back-ported) |
| older  | ❌            |

## Scope

In scope:

- Anything in `backend/`, `cli/`, `ui/`, `site/`, or `infra/` shipped
  from this repo.
- The MCP server contract: tool input validation, output sanitisation,
  read-only Git enforcement, path traversal refusal.
- The HTTP API: authentication assumptions (loopback only), CORS scope,
  schema validation, error leak surface.
- Build artefacts (Go binaries, Python wheel) once the release pipeline
  ships in Phase 2.

Out of scope:

- Dependencies' own vulnerabilities — please report those upstream and
  open a routine issue here so we can pin a fixed version.
- The deployment topology of `govforge.dev` itself (Caddy, Cloudflare
  tunnel, hypervisor) — this is operational infrastructure, not the
  product.
- Social-engineering issues against maintainers' GitHub accounts.

## Security-by-design checks

The following invariants are enforced by tests on every PR. A change
that breaks any of them won't merge:

- MCP tools never import `subprocess`, `os.system`, or call `eval` /
  `exec`. (`tests/unit/test_security.py::test_mcp_package_does_not_import_subprocess`)
- The Git extractor only uses an allowlist of read-only verbs:
  `diff`, `show`, `log`, `rev_parse`, `ls_tree`, `rev_list`, `cat_file`.
  (`test_core_git_uses_read_only_verbs_only`)
- `assert_path_in_repo` rejects symlinks that escape the repo root after
  resolution. (`test_assert_path_in_repo_rejects_symlink_escape`)
- No registered MCP tool is named `run_shell` / `exec` / `system` /
  `spawn`. (`test_no_mcp_tool_named_like_shell`)

If you find a hole in any of those, that's the bug. Please report it.

## Hall of fame

(Reserved for security researchers who report valid issues.)

---

For background on what GovForge does and doesn't try to defend against,
see [`docs/threat-model.md`](docs/threat-model.md).
