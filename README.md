# GovForge

> Governance infrastructure for AI coding agents.

GovForge est une couche de gouvernance Git-aware pour agents IA de développement (Claude Code, Codex, Cursor, Cline, Aider, etc.). Elle rend les changements de code produits par des agents IA **traçables, reviewables, gouvernables et auditables**.

**Statut** : Phase 1 (MVP local) en planification. Site marketing déployé : <https://govforge.dev>.

## Stack

- **Backend** : Python 3.12 + FastMCP + FastAPI + SQLAlchemy 2 + SQLite
- **CLI `gf`** : Go 1.22+ + Cobra
- **UI** : Next.js + Tailwind + shadcn/ui
- **Infra** : Podman rootless + Cloudflare Tunnel + Caddy

## Repository layout (monorepo)

| Dossier | Rôle | Statut |
|---------|------|--------|
| [`backend/`](./backend/) | Python : FastMCP server + FastAPI + SQLAlchemy services | 🚧 scaffolding |
| [`cli/`](./cli/) | Go : binaire `gf` (developer CLI) | 🚧 scaffolding |
| [`ui/`](./ui/) | Next.js : cockpit local (lancé par `gf ui serve`) | 🚧 scaffolding |
| [`site/`](./site/) | Next.js : site marketing public (govforge.dev) | ✅ déployé |
| [`infra/`](./infra/) | Configurations infrastructure (sudoers, Caddy, Podman quadlet) | ✅ déployé |
| [`.github/workflows/`](./.github/workflows/) | CI : backend, cli, ui, release (GoReleaser) | ✅ |

## License

[Apache License 2.0](./LICENSE) — see [`LICENSE`](./LICENSE) and [`NOTICE`](./NOTICE).

Copyright 2026 Eric Vaillancourt and GovForge contributors.
