# GovForge for VS Code

Local-first governance for AI coding agents — tasks, decisions, reviews and
approvals in your sidebar. Connects to a GovForge backend over HTTP (local
`gf api serve` or hosted `api.govforge.dev`).

> **Phase 1 (v0.1.0)** — read-only sidebar. Tasks, Decisions, Reviews trees
> for the active workspace, plus a status bar summary. Write commands and
> decision detail webviews land in v0.2 and v0.3 respectively.

## Install

This package isn't on the Marketplace yet. Sideload the `.vsix`:

```bash
git clone https://github.com/ericvaillancourt/govforge
cd govforge/vscode
npm install
npm run compile
npx vsce package
code --install-extension govforge-0.1.0.vsix
```

## Configure

1. Open VS Code in a Git repo registered as a GovForge project (`gf init`
   in that repo creates the project row + an admin token at
   `~/.config/govforge/auth.toml`).
2. `Cmd/Ctrl+Shift+P` → **GovForge: Sign In** → paste a `gfp_` token. Make
   one at <https://govforge.dev/account/> or use the admin token from
   `auth.toml`.
3. Click the GovForge icon in the activity bar (shield). Three views show
   up: Tasks, Decisions, Reviews. The status bar gets a summary item.

## Configuration

| Setting             | Default                       | Description                                                                                  |
|---------------------|-------------------------------|----------------------------------------------------------------------------------------------|
| `govforge.apiUrl`   | `http://127.0.0.1:8787`       | Backend base URL. Use the hosted endpoint `https://api.govforge.dev` if you don't run local. |

## Development

Open `vscode/` in VS Code, then press **F5** (Run > Start Debugging). This
launches a second VS Code window labelled `[Extension Development Host]`
with the extension loaded. Each F5 runs `npm run compile` first (~50 ms).

For a hot-reload loop, run `npm run watch` in a terminal — esbuild rebuilds
on every save. Reload the dev host with `Cmd/Ctrl+R` to pick up the change.

Type-check the whole project at once with `npm run lint`. The compile
script already does it; this is faster when you just want to verify types.

## Roadmap

- **v0.1.0 (now)** — read sidebar + auth + status bar
- **v0.2.0** — decision detail webview (summary, git change, findings, timeline)
- **v0.3.0** — author actions (create task, record decision, attach git, run policy)
- **v0.4.0** — review and approval actions (submit review, approve, reject, record disagreement)
- **v0.5.0** — inline gutter annotations from review findings (ESLint-style)

## License

Apache-2.0. Part of the [GovForge](https://github.com/ericvaillancourt/govforge) project.
