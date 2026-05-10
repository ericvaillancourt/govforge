# Contributing to GovForge

Thanks for considering a contribution. GovForge is governance plumbing
for AI coding agents — it ships in three languages (Python, Go, TypeScript)
with strict tests on each side, so the contribution loop has a few
specific shapes worth knowing.

## Ground rules

1. **Discuss before refactoring.** Open a GitHub Discussion or issue
   first if your change touches more than ~200 lines or crosses a
   package boundary.
2. **Tests are non-negotiable.** Every PR keeps backend coverage
   ≥ 80 % and Go CLI coverage ≥ 70 % per package. Security attestation
   tests must keep passing — they're the only thing standing between
   "MCP tools are safe" and "we're claiming they're safe."
3. **No backwards-compat shims.** We're pre-1.0; rename the thing.
4. **English in code + commits, English or French in docs.**
   The marketing site is bilingual; the engineering surface is English
   only.

## Repository layout

This is a monorepo. Each top-level folder has its own README:

- [`backend/`](backend/) — Python (FastMCP + FastAPI + SQLAlchemy)
- [`cli/`](cli/) — Go (Cobra + Viper + resty + lipgloss)
- [`ui/`](ui/) — Next.js cockpit
- [`site/`](site/) — Next.js marketing site at govforge.dev
- [`docs/`](docs/) — architecture, data model, threat model
- [`infra/`](infra/) — Caddy + Podman quadlets + sudoers

## Local setup

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pytest -q                       # 97 tests, ~3s
ruff format --check src tests
ruff check src tests
mypy src                        # strict mode
```

### CLI

```bash
cd cli
go build -o ~/bin/gf ./cmd/gf
go test -race -cover ./...
```

### UI

```bash
cd ui
npm ci
npm run dev                     # http://localhost:8788
npm run type-check && npx eslint .
```

### Marketing site

```bash
cd site
npm ci
npm run dev                     # http://localhost:3000
```

## Commit messages

We follow a slim
[Conventional Commits](https://www.conventionalcommits.org/) variant.
The scope is the package or workstream, not the file.

```
<type>(<scope>): <imperative summary>

<body — what changed and why, in full sentences>

<optional footers, e.g. Co-Authored-By, Closes #N>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `ci`, `infra`, `brand`,
`chore`. Scope tags from the workstream catalogue (`backend(B)`,
`cli(G)`, `ui(I)`, `tests(J)`, `docs(K)`, `brand(L)`, …) are welcome
but not required for small fixes.

Examples in this repo:

```
backend(F): FastMCP server — 11 tools, 5 resources, 3 prompts, integration tests
brand(L): SVG mark + wordmark + favicon + OG image + brand guide
docs(K): per-package READMEs + docs/ + CHANGELOG (Phase 1 documentation)
```

## Pull requests

- Branch off `main`. Keep PRs **focused** — one workstream per PR is the
  ideal; one logical change per PR is the floor.
- Fill out [`PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md)
  — the `## Test plan` section is mandatory.
- CI must be green. The four required checks are:
  - `backend / lint-and-test`
  - `cli / lint-and-test`
  - `ui / lint-and-build`
  - any new workflow you add
- A maintainer review is required before merge.
- Squash-merge by default. The squash commit's title becomes the
  changelog entry — write it like one.

## Code style

- **Python**: ruff format + ruff check + mypy strict. No `# type: ignore`
  without a one-line justification. Follow the comment-only-when-non-obvious
  rule (see existing service modules for the tone).
- **Go**: gofmt + go vet + golangci-lint. Tests in `_test.go` live next
  to the file under test, not in a separate `tests/` tree.
- **TypeScript**: Next's eslint config + Prettier defaults. No barrel
  files (`index.ts` re-exports); explicit module paths.

## Adding a new policy

The five default policies are simple subclasses of `Policy` in
[`backend/src/govforge/core/policies/defaults.py`](backend/src/govforge/core/policies/defaults.py).
A new policy is:

1. A class extending `Policy` with `name`, `description`, and
   `evaluate(ctx) -> PolicyVerdict | None`.
2. An entry in `DEFAULT_POLICY_CLASSES`.
3. A test in
   [`backend/tests/unit/test_policies.py`](backend/tests/unit/test_policies.py)
   covering BLOCKED / WARNING / PASSED branches plus the
   "doesn't apply" case.
4. (Optional) A default config block in
   [`cli/internal/embed/assets/policies.toml`](cli/internal/embed/assets/policies.toml)
   so `gf init` ships it enabled.

## Adding an MCP tool

1. Pydantic input + output models in
   [`backend/src/govforge/mcp/schemas.py`](backend/src/govforge/mcp/schemas.py).
2. Tool registration in
   [`backend/src/govforge/mcp/tools.py`](backend/src/govforge/mcp/tools.py).
   Use individual typed parameters, **not** a wrapping payload model
   (the FastMCP JSON schema would otherwise gain a useless `payload`
   wrapper).
3. Integration test in
   [`backend/tests/unit/test_mcp.py`](backend/tests/unit/test_mcp.py)
   — drive the new tool through the in-process `Client`.
4. Documentation update in
   [`docs/mcp-integration.md`](docs/mcp-integration.md).

If your tool spawns a subprocess, opens a network connection, or
performs a destructive Git operation, **stop**. Those capabilities are
deliberately out of Phase 1 scope (see
[`docs/threat-model.md`](docs/threat-model.md)). Open a Discussion to
re-litigate the scope before writing code.

## Adding an HTTP route

1. Pydantic request/response in
   [`backend/src/govforge/api/schemas.py`](backend/src/govforge/api/schemas.py)
   — use `extra="forbid"` on requests so typos fail with 422.
2. Router file in
   [`backend/src/govforge/api/routers/`](backend/src/govforge/api/routers/).
   Bring in `Depends(get_session)` for DB access.
3. Test in
   [`backend/tests/unit/test_api.py`](backend/tests/unit/test_api.py)
   using `fastapi.testclient.TestClient` over a file-backed SQLite.
4. The corresponding `client.<Method>` in
   [`cli/internal/client/client.go`](cli/internal/client/client.go) +
   typed struct in `types.go`.
5. Cobra command (or extend an existing one) in
   [`cli/internal/commands/`](cli/internal/commands/).

## Reporting bugs

Use the [`bug_report.yml`](.github/ISSUE_TEMPLATE/bug_report.yml)
template. Include:

- The exact `gf` / Python / Node version (`gf version`,
  `python --version`, `node --version`).
- The OS + arch.
- A minimal reproduction. "I ran `gf foo` and got `bar`" beats a
  screenshot every time.
- Logs from `gf api serve` / `gf mcp serve` if the bug is in the
  backend path.

For security-relevant issues, **don't open a public bug** — see
[`SECURITY.md`](SECURITY.md).

## License

By contributing, you agree your contribution is licensed under
[Apache 2.0](LICENSE). No CLA is required.
