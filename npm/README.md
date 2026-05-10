# `@govforge/cli` — npm wrapper

Thin Node wrapper around the `gf` CLI binary. Lets MCP-aware tooling
that prefers `npx` install GovForge without separately downloading the
Go binary.

```bash
# One-off:
npx @govforge/cli init

# Globally:
npm install -g @govforge/cli
gf init
```

## What this package does

- The `postinstall` hook downloads the matching `gf` binary from
  [GitHub Releases](https://github.com/ericvaillancourt/govforge/releases)
  for your OS + arch.
- It verifies the SHA-256 against the `checksums.txt` shipped with the
  release before extracting.
- Installs the binary into `node_modules/@govforge/cli/bin/`. The
  `bin/gf.cjs` shim execs it with the user's arguments.

## What it doesn't do

- It doesn't ship a JavaScript reimplementation of `gf`. The Go binary
  is the only thing that runs.
- It doesn't auto-update. To upgrade, bump the package: `npm install -g @govforge/cli@latest`.
- It doesn't bundle the Python backend. For the backend, see
  [`pip install govforge`](https://pypi.org/project/govforge/) or the
  `gf api serve` command (which spawns the Python entry point).

## Source of truth

The actual CLI code lives in
[`cli/`](https://github.com/ericvaillancourt/govforge/tree/main/cli).
This wrapper exists in
[`npm/`](https://github.com/ericvaillancourt/govforge/tree/main/npm) of
the same monorepo.

## License

[Apache 2.0](https://github.com/ericvaillancourt/govforge/blob/main/LICENSE).
