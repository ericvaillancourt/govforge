# Release Runbook

End-to-end recipe for cutting a GovForge release. Phase 1 / Phase 2
ship a single tag (`v0.1.0`) that triggers four publish workflows in
parallel: GitHub Releases (Go binaries + Homebrew), PyPI (Python
backend), npm (`@govforge/cli` wrapper), and GHCR (backend container).

## One-time setup (do this before the first tag)

### 1. PyPI Trusted Publishing

1. Create the project on PyPI by uploading **once** with an API token,
   then convert to Trusted Publishing — or register a "pending" project
   to start with TP from the first publish:
   <https://pypi.org/manage/account/publishing/>.
2. Add a Trusted Publisher with:
   - **PyPI Project Name**: `govforge`
   - **Owner**: `ericvaillancourt`
   - **Repository name**: `govforge`
   - **Workflow filename**: `pypi.yml`
   - **Environment name**: leave blank
3. The first run of the workflow on a `v*.*.*` tag will publish without
   needing any token in the repo.

### 2. npm publishing

1. Sign in to <https://www.npmjs.com/> and either reserve `@govforge`
   org or use your personal scope.
2. Create the package: `npm init --scope=@govforge` (we already ship
   `npm/package.json`).
3. Generate an automation token at npm → Access Tokens → Granular →
   Publish-only on `@govforge/*`.
4. Add the token to GitHub repo secrets as `NPM_TOKEN`.
5. (Optional, recommended) Configure
   [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers)
   so future publishes use OIDC instead of the token.

### 3. Homebrew tap

1. Create `https://github.com/ericvaillancourt/homebrew-tap` (an empty
   public repo is enough — GoReleaser commits the cask to
   `Casks/govforge.rb` on its `main` branch on each release).
2. Generate a fine-grained PAT scoped to that single repo with
   **Contents: read & write**.
3. Add it to GovForge repo secrets as `HOMEBREW_TAP_GITHUB_TOKEN`.

### 4. GHCR

No setup needed — `${{ secrets.GITHUB_TOKEN }}` is auto-provisioned by
Actions and has `packages: write` once the workflow declares the
permission. The container at
`ghcr.io/ericvaillancourt/govforge-backend` is created on the first
successful push.

### 5. Cosign keyless signing

No setup needed. The release workflow uses Sigstore's GitHub Actions
OIDC issuer; verifiers just need the certificate identity.

---

## Cutting a release

```bash
# 0. Make sure main is green and the CHANGELOG is updated.
git pull --ff-only
gh run list --branch main --limit 5      # last 5 runs should be green

# 1. Bump versions in lock-step. Three files carry the version string:
#       backend/pyproject.toml      (version = "0.1.0")
#       npm/package.json            ("version": "0.1.0")
#       docs/* references           (cli-reference, changelog, brand)

# 2. Commit the bump:
git add backend/pyproject.toml npm/package.json CHANGELOG.md
git commit -m "release: cut v0.1.0"
git push

# 3. Tag (signed if you have a key; otherwise plain annotated):
git tag -s v0.1.0 -m "v0.1.0"     # or: git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
```

The push of the tag triggers four workflows simultaneously:

| Workflow                | Outcome                                                  |
|-------------------------|----------------------------------------------------------|
| `release.yml`           | GoReleaser → 5 Go binary archives + checksums + cosign signature + Homebrew Cask (pushed to `ericvaillancourt/homebrew-tap` `Casks/govforge.rb`). Posted as a GitHub Release. |
| `pypi.yml`              | `python -m build` → sdist + wheel → PyPI via Trusted Publishing |
| `npm.yml`               | `npm publish --provenance` → `@govforge/cli` on the public registry |
| `docker.yml`            | Multi-arch (`linux/amd64`, `linux/arm64`) backend image to `ghcr.io/ericvaillancourt/govforge-backend:<version>` + `:latest` + provenance attestation |

Watch them:

```bash
gh run list --workflow release.yml --limit 1 --json status,conclusion,url
gh run watch                            # interactively
```

## Post-release verification

```bash
# 1. Go binary via install.sh:
curl -fsSL https://govforge.dev/install.sh | sh
gf version

# 2. Homebrew tap:
brew tap ericvaillancourt/tap
brew install govforge
gf version

# 3. PyPI:
pipx install govforge
python -c "import govforge; print(govforge.__version__)"

# 4. npm:
npx -y @govforge/cli@latest version

# 5. GHCR backend container:
podman run --rm ghcr.io/ericvaillancourt/govforge-backend:latest --version

# 6. Cosign verification of the release:
cosign verify-blob \
  --certificate https://github.com/ericvaillancourt/govforge/releases/download/v0.1.0/checksums.txt.pem \
  --signature   https://github.com/ericvaillancourt/govforge/releases/download/v0.1.0/checksums.txt.sig \
  --certificate-identity-regexp 'https://github.com/ericvaillancourt/govforge' \
  --certificate-oidc-issuer    https://token.actions.githubusercontent.com \
  <(curl -sSL https://github.com/ericvaillancourt/govforge/releases/download/v0.1.0/checksums.txt)
```

## MCP registry submissions

Manual step — registries don't accept CI submissions yet. Submit after
the v0.1.0 release lands:

| Registry                                          | URL                                                                       |
|---------------------------------------------------|---------------------------------------------------------------------------|
| Anthropic / official MCP servers list             | <https://github.com/modelcontextprotocol/servers> — open a PR adding GovForge to README + an entry under `src/`. |
| Smithery (community registry)                     | <https://smithery.ai/submit>                                              |
| `mcp.so`                                          | <https://mcp.so/submit>                                                   |
| `glama.ai/mcp/servers`                            | <https://glama.ai/mcp/servers/submit>                                     |
| Awesome MCP Servers (lists)                       | PR to <https://github.com/punkpeye/awesome-mcp-servers> + similar lists   |

For each submission include:

- Description: "Local-first governance for AI coding agents — audit
  trail, policy checks, structured reviews, human approval. Apache 2.0."
- Install command: `pipx install govforge` and `python -m govforge.mcp.server`
- Repo: `https://github.com/ericvaillancourt/govforge`
- Docs: `https://govforge.dev/en/docs/`
- Tools count: 11 · Resources: 5 · Prompts: 3
- Example client config: copy from
  [`docs/mcp-integration.md`](mcp-integration.md).

## Hot-patch / re-release

If a workflow fails partway through:

| Failed step                | Recovery                                                                  |
|----------------------------|---------------------------------------------------------------------------|
| GoReleaser only            | Re-run the workflow: `gh workflow run release.yml --ref v0.1.0`            |
| PyPI only                  | `gh workflow run pypi.yml --ref v0.1.0` (manual dispatch path is wired)    |
| npm only                   | `gh workflow run npm.yml --ref v0.1.0`                                     |
| Docker only                | `gh workflow run docker.yml --ref v0.1.0`                                  |
| All four                   | Bump to `v0.1.1`, push the new tag, fix-forward.                          |

PyPI **does not allow re-uploading** the same version even after a
delete — so if `0.1.0` ships partially broken, the recovery is `0.1.1`,
not "delete + re-upload `0.1.0`". Plan accordingly.

## Pre-release dry run (snapshot mode)

GoReleaser supports a `--snapshot` build that doesn't push anything:

```bash
cd cli
goreleaser release --clean --snapshot --skip=publish,sign
```

This is the right way to verify the build matrix before a real tag.
