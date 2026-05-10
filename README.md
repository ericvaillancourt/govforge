# GovForge

> Governance infrastructure for AI coding agents.

GovForge est une couche de gouvernance Git-aware pour agents IA de développement (Claude Code, Codex, Cursor, Cline, Aider, etc.). Elle rend les changements de code produits par des agents IA **traçables, reviewables, gouvernables et auditables**.

**Statut** : Phase 1 (MVP local) en planification. Site marketing déployé : <https://govforge.dev>.

## Stack

- **Backend** : Python 3.12 + FastMCP + FastAPI + SQLAlchemy 2 + SQLite
- **CLI `gf`** : Go 1.22+ + Cobra
- **UI** : Next.js + Tailwind + shadcn/ui
- **Infra** : Podman rootless + Cloudflare Tunnel + Caddy

## Repository layout

| Dossier / fichier | Rôle |
|-------------------|------|
| [`site/`](./site/) | Site marketing Next.js (govforge.dev) |
| [`infra/`](./infra/) | Configurations infrastructure (sudoers, Caddy, Podman quadlet) |

## License

[Apache License 2.0](./LICENSE) — see [`LICENSE`](./LICENSE) and [`NOTICE`](./NOTICE).

Copyright 2026 Eric Vaillancourt and GovForge contributors.
