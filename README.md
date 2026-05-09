# GovForge

> Governance infrastructure for AI coding agents.

GovForge est une couche de gouvernance Git-aware pour agents IA de développement (Claude Code, Codex, Cursor, Cline, Aider, etc.). Elle rend les changements de code produits par des agents IA **traçables, reviewables, gouvernables et auditables**.

**Statut** : Phase 1 (MVP local) en planification. Voir [`TODO.md`](./TODO.md) pour le roadmap exécutable.

## Documents

| Fichier | Rôle |
|---------|------|
| [`roadmap.md`](./roadmap.md) | Vision stratégique, positionnement, monétisation, GTM |
| [`devis.md`](./devis.md) | Cahier de charges technique Phase 1 |
| [`architecture.md`](./architecture.md) | Architecture logicielle + déploiement (`.4`/`.5`/Cloudflare/Podman) |
| [`TODO.md`](./TODO.md) | Roadmap exécutable avec checkboxes Claude Code |
| [`infra/`](./infra/) | Configurations infrastructure (sudoers, Caddy, Podman quadlet) |

## Stack

- **Backend** : Python 3.12 + FastMCP + FastAPI + SQLAlchemy 2 + SQLite
- **CLI `gf`** : Go 1.22+ + Cobra
- **UI** : Next.js 14 + Tailwind + shadcn/ui
- **Infra** : Podman rootless + Cloudflare Tunnel + Caddy

## License

Apache 2.0 (à ajouter formellement quand le code arrive).
