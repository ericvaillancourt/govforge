# GovForge — Plan site web public

> Inspiration : Context7 (`context7.com`)
> Cible : `https://govforge.dev`
> Statut : planning + wireframes (pas encore de code)

---

## 1. Décisions de design

### 1.1 Pourquoi le style Context7

Context7 réussit ce que GovForge doit aussi réussir :

- **Vendre un produit technique à des devs** sans tomber dans la hype IA générique
- **Démontrer la valeur en 5 secondes** via un install snippet visible immédiatement
- **Sérieux sans austérité** — typographie soignée, dark mode, espace généreux
- **Pas de chatbot, pas d'animations marketing** — l'esthétique IS le pitch

GovForge récupère :

- Dark theme par défaut + light toggle
- Big bold typography (60-80px hero)
- Install command card en hero (CLI > marketing copy)
- Sections aérées, max-width contenu (~1200px)
- Grille de "supported agents" avec logos (au lieu de "supported libraries")
- Code snippets verbatim dans les sections "how it works"

GovForge **ne récupère pas** :

- Search bar centrale (Context7 EST un moteur de recherche, GovForge est une infra)
- Library cards interactives (pas pertinent ici)
- Stats publiques type "X queries today" (peut venir Phase 3)

### 1.2 Tonalité éditoriale

Aligné `roadmap.md` §11.1 :

| À faire | À éviter |
|---------|----------|
| **Govern**, audit, traceability, control, infrastructure, compliance | autonomous, agentic, AGI, copilot, magic |
| **Engineering tone** : terms techniques, snippets concrets | hype tone : "AI-powered", "next-gen", "revolutionary" |
| **Chiffres et garanties** : "Apache 2.0", "self-hosted", "no telemetry" | promesses vagues : "supercharge your workflow" |
| **Démo workflow** : un agent commit → review → désaccord → approval | démo "watch AI write code" |

### 1.3 Stack technique

Aligné `architecture.md` §1 et `TODO.md` workstream N :

| Élément | Choix |
|---------|-------|
| Framework | Next.js 14 App Router |
| Style | Tailwind CSS 3 + `@tailwindcss/typography` |
| Composants | shadcn/ui (Button, Card, Tabs, CodeBlock custom) |
| Typographie | Geist Sans (UI) + Geist Mono (code) — fonts open source de Vercel |
| Icônes | Lucide React (cohérent avec shadcn) |
| Theming | `next-themes` (dark default, light toggle) |
| Syntax highlighting | `shiki` ou `prism-react-renderer` pour les snippets |
| Build target | Static export (`next export`) → servable via Caddy directement |
| Container | `infra/podman/quadlet/govforge-site.container` (image Caddy + static files OU image Node si SSR) |

**Décision Static Export vs SSR** : on commence en **static export** (plus simple, pas de runtime Node sur `.5`, le container = juste Caddy + fichiers statiques). Si on a besoin d'ISR/dynamique plus tard (e.g. blog avec MDX), on migrera à SSR Node.

### 1.4 Pages livrées en Phase 2 (lancement)

Minimal viable pour le launch :

| Route | Contenu | Priorité |
|-------|---------|----------|
| `/` | Homepage complète (hero → features → workflow → install → CTA) | **MUST** |
| `/pricing` | OSS gratuit vs Enterprise (placeholder Phase 3) | **MUST** |
| `/docs` | Redirect vers `docs.govforge.dev` (container séparé) ou `/docs/quickstart` | SHOULD |
| `/blog` | Index posts MDX (vide au launch) | NICE |
| `/security` | Threat model résumé + lien GitHub `SECURITY.md` | NICE |
| `/changelog` | Tirée des GitHub Releases via SSG build-time | NICE |
| `/404`, `/500` | Pages d'erreur custom | MUST |

Hors scope launch : signup/login, dashboard SaaS, demo interactive (Phase 3).

---

## 2. Wireframes — Homepage

> Convention : `╭─╮ │ ╰─╯` = bordures, `▮` = boutons primaires, `▯` = boutons secondaires, `›` = liens

### 2.1 Top nav (sticky)

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  ⚙ GovForge                  Features  Workflow  Pricing  Docs        [▮]   ║
║                                                              ⭐ 1.2k │ GitHub ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

- Logo wordmark à gauche (icône engrenage + "GovForge" en Geist Sans Bold)
- Liens centrés/droite : Features, Workflow, Pricing, Docs
- À droite : badge GitHub stars (live count via Octocat API ou static au build), bouton "GitHub" (couleur accent)
- Sur scroll : background passe de transparent à `bg-zinc-900/80 backdrop-blur` (effet Context7)

### 2.2 Hero

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║                                                                              ║
║               Govern AI coding agents                                        ║
║               before they govern your codebase.                              ║
║                                                                              ║
║               Audit, review and control every code decision                  ║
║               produced by Claude Code, Codex, Cursor and others.             ║
║                                                                              ║
║                                                                              ║
║      ╭───────────────────────────────────────────────────╮                   ║
║      │  $ curl -sSL https://govforge.dev/install.sh | sh │  📋              ║
║      ╰───────────────────────────────────────────────────╯                   ║
║                                                                              ║
║                                                                              ║
║      [▮ Get started →]    [▯ View on GitHub]    › Read the docs              ║
║                                                                              ║
║                                                                              ║
║      Open source · Apache 2.0 · Self-hosted · No telemetry                   ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

- Tagline en deux lignes, Geist Sans 64-80px, line-height tight (1.05)
- Sous-titre 18-20px, opacity 0.7, max-width ~600px
- **Install snippet** dans une card monospace, bouton copy-to-clipboard, ombre subtile (Context7-like)
- 3 CTAs : primaire "Get started" (link vers `/docs/quickstart`), secondaire "GitHub" (open new tab), tertiaire "Read the docs" (lien text)
- Trust strip (4 puces) en bas, font-size petit, opacity 0.5

### 2.3 Supported agents (social proof technique)

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║                Works with the agents you already use                         ║
║                                                                              ║
║      ╭────────╮  ╭────────╮  ╭────────╮  ╭────────╮  ╭────────╮              ║
║      │ Claude │  │ Codex  │  │ Cursor │  │ Cline  │  │ Aider  │              ║
║      │  Code  │  │ (CLI)  │  │        │  │        │  │        │              ║
║      ╰────────╯  ╰────────╯  ╰────────╯  ╰────────╯  ╰────────╯              ║
║      ╭────────╮  ╭────────╮  ╭────────╮  ╭────────╮                          ║
║      │RooCode │  │Continue│  │  Zed   │  │ + MCP  │                          ║
║      ╰────────╯  ╰────────╯  ╰────────╯  ╰────────╯                          ║
║                                                                              ║
║         Any tool that speaks the Model Context Protocol works.               ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

- Grille 5×2 de cards monochromes avec logo + nom de l'agent
- Cards en greyscale par défaut, deviennent colorées au hover
- Note en bas : "MCP-compatible" pour normaliser

### 2.4 The problem (positionnement)

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║                  AI agents now write production code.                        ║
║                  Most teams have no idea what they decided, or why.          ║
║                                                                              ║
║   ╭──────────────────────────────╮  ╭──────────────────────────────╮         ║
║   │  ❌ Without GovForge          │  │  ✅ With GovForge             │         ║
║   ├──────────────────────────────┤  ├──────────────────────────────┤         ║
║   │ • Decisions are implicit      │  │ • Every decision recorded    │         ║
║   │ • Reviews are inconsistent    │  │ • Reviews are structured     │         ║
║   │ • Risks slip through          │  │ • Policies catch them        │         ║
║   │ • Audit trails don't exist    │  │ • Git-aware audit timeline   │         ║
║   │ • Disagreements are lost      │  │ • Disagreements are explicit │         ║
║   │ • Humans rubber-stamp         │  │ • Humans approve with context│         ║
║   ╰──────────────────────────────╯  ╰──────────────────────────────╯         ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

- Deux cards côte-à-côte (responsive : stack vertical sur mobile)
- Couleur accent rouge subtile à gauche, vert subtile à droite (icônes seulement, pas de fond saturé)

### 2.5 Features grid (6 cartes)

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║                          What GovForge gives you                             ║
║                                                                              ║
║   ╭───────────────────╮  ╭───────────────────╮  ╭───────────────────╮        ║
║   │  📜               │  │  ⚖️               │  │  🛡️               │        ║
║   │  Decision Records │  │  Policy Engine    │  │  Audit Timeline   │        ║
║   │                   │  │                   │  │                   │        ║
║   │  Every code change│  │  Block changes    │  │  Append-only event│        ║
║   │  becomes a struc- │  │  that touch auth, │  │  log linked to    │        ║
║   │  tured decision   │  │  secrets, schema. │  │  every commit.    │        ║
║   ╰───────────────────╯  ╰───────────────────╯  ╰───────────────────╯        ║
║                                                                              ║
║   ╭───────────────────╮  ╭───────────────────╮  ╭───────────────────╮        ║
║   │  🤝               │  │  ✋               │  │  🔍               │        ║
║   │  Structured       │  │  Human Approval   │  │  Git-aware Reviews│        ║
║   │  Disagreement     │  │                   │  │                   │        ║
║   │                   │  │                   │  │                   │        ║
║   │  Capture conflicts│  │  Block merges on  │  │  Review by another│        ║
║   │  between agents.  │  │  high-risk diffs. │  │  agent. Findings  │        ║
║   │                   │  │                   │  │  attached to lines│        ║
║   ╰───────────────────╯  ╰───────────────────╯  ╰───────────────────╯        ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

- 3×2 grid sur desktop, 1 colonne sur mobile
- Icônes Lucide (pas emojis dans le vrai site — emojis ici juste pour wireframe)
- Hover : lift subtil + bordure accent

### 2.6 How it works — workflow demo

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║                            How it works                                      ║
║                                                                              ║
║                                                                              ║
║   1. Claude modifies auth.py                                                 ║
║   ╭────────────────────────────────────────────────────────────────╮         ║
║   │ $ gf task create --title "Migrate auth to signed cookies"      │         ║
║   │ TASK-001 created                                               │         ║
║   │                                                                │         ║
║   │ # Claude commits the change                                    │         ║
║   │ $ git commit -m "refactor(auth): signed session cookies"       │         ║
║   │                                                                │         ║
║   │ $ gf git attach --decision DEC-001 --commit HEAD               │         ║
║   ╰────────────────────────────────────────────────────────────────╯         ║
║                                                                              ║
║   2. Policy engine flags the change                                          ║
║   ╭────────────────────────────────────────────────────────────────╮         ║
║   │ $ gf policy check --decision DEC-001                           │         ║
║   │                                                                │         ║
║   │ ⚠ BLOCKED  auth_change_requires_review                         │         ║
║   │            auth.py modified — review required                  │         ║
║   │ ✓ PASSED   secret_pattern_detection                            │         ║
║   │ ✓ PASSED   test_required_for_high_risk                         │         ║
║   ╰────────────────────────────────────────────────────────────────╯         ║
║                                                                              ║
║   3. Codex reviews and disagrees                                             ║
║   ╭────────────────────────────────────────────────────────────────╮         ║
║   │ $ gf review request --decision DEC-001 --reviewer codex        │         ║
║   │                                                                │         ║
║   │ 📝 codex submitted REV-001 → changes_requested                 │         ║
║   │    high  security  middleware/session.py:42                    │         ║
║   │          Session token is not rotated after login.             │         ║
║   │                                                                │         ║
║   │ ⚡ Disagreement recorded:                                      │         ║
║   │    Author: signed cookies are sufficient                       │         ║
║   │    Reviewer: signed cookies do not prevent fixation            │         ║
║   ╰────────────────────────────────────────────────────────────────╯         ║
║                                                                              ║
║   4. Human approves after fix                                                ║
║   ╭────────────────────────────────────────────────────────────────╮         ║
║   │ $ gf approve DEC-001 --comment "Approved after token rotation" │         ║
║   │                                                                │         ║
║   │ ✓ DEC-001 approved by eric                                     │         ║
║   │ ✓ TASK-001 closed                                              │         ║
║   │                                                                │         ║
║   │ Audit trail: 7 events, 1 commit, 1 review, 1 disagreement      │         ║
║   ╰────────────────────────────────────────────────────────────────╯         ║
║                                                                              ║
║              [▮ See the full workflow →]   [▯ Watch 90s demo]                ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

- 4 étapes numérotées, chacune avec un terminal-like card monospace
- Snippets utilisent les vraies commandes du `gf` CLI (cohérence avec `devis.md` §13)
- ⚡ et 📝 = icônes Lucide stylisées en couleur (vert pour ✓, jaune pour ⚠, rouge pour ❌)
- CTAs en bas vers documentation longue + démo vidéo (workstream Q)

### 2.7 Architecture diagram

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║                       Local-first. Git-native.                               ║
║                                                                              ║
║                                                                              ║
║   ╭──────────╮       ╭──────────────────╮      ╭──────────────────╮          ║
║   │  Claude  │──MCP──▶│  GovForge MCP    │      │  Git (read-only) │          ║
║   │  Codex   │──────▶│  Server          │◀─────│  diff, commits,  │          ║
║   │  Cursor  │──────▶│                  │      │  files, branches │          ║
║   ╰──────────╯       ╰──────────────────╯      ╰──────────────────╯          ║
║                              │                                               ║
║                              ▼                                               ║
║                       ╭──────────────────╮      ╭──────────────────╮         ║
║                       │  Decision Store  │◀─────│  Policy Engine   │         ║
║                       │  (SQLite local)  │      │  auth/secrets/   │         ║
║                       │                  │      │  diff size/...   │         ║
║                       ╰──────────────────╯      ╰──────────────────╯         ║
║                              │                                               ║
║                              ▼                                               ║
║                       ╭──────────────────╮      ╭──────────────────╮         ║
║                       │  Audit Timeline  │      │  Human Approval  │         ║
║                       │  (append-only)   │◀─────│  (CLI / UI)      │         ║
║                       ╰──────────────────╯      ╰──────────────────╯         ║
║                                                                              ║
║                                                                              ║
║      Everything runs on your machine. No cloud unless you choose.            ║
║      Optional team sync (Phase 3) for collaboration & enterprise.            ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

- Diagramme rendu en SVG (généré depuis Mermaid puis exporté, ou hand-coded en Figma)
- Cartes minimalistes, lignes fines, flèches pleines vs pointillées (selon flux)
- Texte sous le diagramme insiste sur **local-first** (différenciateur)

### 2.8 Open Source / Enterprise split

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║               Open core. Pay only for what teams actually need.              ║
║                                                                              ║
║   ╭────────────────────────────────╮   ╭────────────────────────────────╮    ║
║   │                                │   │                                │    ║
║   │   📦 Open Source               │   │   🏢 Enterprise                │    ║
║   │   Apache 2.0 · Forever free    │   │   For teams & compliance       │    ║
║   │                                │   │                                │    ║
║   │   ✓  MCP server                │   │   Everything in OSS, plus:     │    ║
║   │   ✓  CLI (gf)                  │   │                                │    ║
║   │   ✓  Local SQLite              │   │   ✓  Cloud sync                │    ║
║   │   ✓  Git-aware reviews         │   │   ✓  Team workspaces           │    ║
║   │   ✓  Decision timeline         │   │   ✓  RBAC + SSO/SAML           │    ║
║   │   ✓  Default policies          │   │   ✓  Air-gapped deployment     │    ║
║   │   ✓  Local UI cockpit          │   │   ✓  Advanced policies         │    ║
║   │   ✓  Self-hosted               │   │   ✓  Compliance reports        │    ║
║   │                                │   │   ✓  SLA support               │    ║
║   │                                │   │                                │    ║
║   │   [▯ Install →]                │   │   [▮ Contact sales →]          │    ║
║   │                                │   │                                │    ║
║   ╰────────────────────────────────╯   ╰────────────────────────────────╯    ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

- Cards de taille égale, alignées
- OSS card légèrement plus discrète (greyscale), Enterprise plus contrastée (bordure accent)
- "Contact sales" → mailto: ou form simple vers `eric.vaillancourt@talsom.com` au début

### 2.9 Trust / Security strip

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║                   Built for code that actually matters                       ║
║                                                                              ║
║   ╭───────────────╮  ╭───────────────╮  ╭───────────────╮  ╭───────────────╮ ║
║   │ 🔒 Local-first│  │ 📜 Apache 2.0 │  │ 🚫 No teleme- │  │ 🔐 Air-gapped │ ║
║   │               │  │               │  │     try       │  │     ready     │ ║
║   │ Your code     │  │ Permissive    │  │               │  │               │ ║
║   │ never leaves  │  │ license,      │  │ Zero phone-   │  │ Enterprise    │ ║
║   │ your machine. │  │ enterprise-   │  │ home. Verify  │  │ deployment in │ ║
║   │               │  │ friendly.     │  │ on GitHub.    │  │ isolated nets │ ║
║   ╰───────────────╯  ╰───────────────╯  ╰───────────────╯  ╰───────────────╯ ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

- Petites cards 4-en-ligne (responsive : 2×2 sur tablet, stack sur mobile)
- Icônes Lucide, texte court (1-2 lignes max)

### 2.10 Final CTA

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║                                                                              ║
║                Stop trusting AI agents on faith.                             ║
║                Start governing them.                                         ║
║                                                                              ║
║                                                                              ║
║      ╭───────────────────────────────────────────────────╮                   ║
║      │  $ curl -sSL https://govforge.dev/install.sh | sh │  📋              ║
║      ╰───────────────────────────────────────────────────╯                   ║
║                                                                              ║
║                                                                              ║
║             [▮ Get started →]    [▯ Star us on GitHub ⭐]                    ║
║                                                                              ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

- Echo du hero pour cohérence (install snippet + CTAs)
- Tagline qui *demande l'action* différente du hero qui *présente le produit*

### 2.11 Footer

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   ⚙ GovForge                                                                ║
║   Governance infrastructure for AI coding agents.                            ║
║                                                                              ║
║   ┌── Product ──┐  ┌── Resources ──┐  ┌── Company ──┐  ┌── Legal ──┐         ║
║   │ Features    │  │ Documentation │  │ About       │  │ License   │         ║
║   │ Pricing     │  │ Changelog     │  │ Contact     │  │ Security  │         ║
║   │ Workflow    │  │ Blog          │  │ GitHub  ↗   │  │ Privacy   │         ║
║   │ Roadmap  ↗  │  │ Docs API      │  │ Twitter ↗   │  │           │         ║
║   └─────────────┘  └───────────────┘  └─────────────┘  └───────────┘         ║
║                                                                              ║
║   ─────────────────────────────────────────────────────────────────          ║
║                                                                              ║
║   © 2026 GovForge. Apache 2.0 licensed.       Made with care in Montréal     ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

- 4 colonnes de liens, simple et plat
- Pas de newsletter (cohérent avec "no telemetry, no tracking")
- Mention "Made in Montréal" (signal humain, comme Context7 mentionne Upstash)

---

## 3. Wireframes — `/pricing`

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  ⚙ GovForge                  Features  Workflow  Pricing  Docs        [▮]   ║
╚══════════════════════════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║                    Pricing as boring as governance should be                 ║
║                                                                              ║
║                                                                              ║
║   ╭──────────────────────╮ ╭──────────────────────╮ ╭──────────────────────╮ ║
║   │                      │ │   Most teams         │ │                      │ ║
║   │   Open Source        │ │   ─────────          │ │   Enterprise         │ ║
║   │                      │ │   Team               │ │                      │ ║
║   │   $0                 │ │                      │ │   Custom             │ ║
║   │   forever            │ │   $X/seat/month      │ │   contact us         │ ║
║   │                      │ │   (Phase 3)          │ │                      │ ║
║   │   ✓ MCP server       │ │                      │ │   ✓ Everything Team  │ ║
║   │   ✓ CLI gf           │ │   ✓ Everything OSS   │ │   ✓ Air-gapped       │ ║
║   │   ✓ Local UI         │ │   ✓ Cloud sync       │ │   ✓ SSO/SAML         │ ║
║   │   ✓ All policies     │ │   ✓ Team workspaces  │ │   ✓ RBAC             │ ║
║   │   ✓ Self-hosted      │ │   ✓ Notifications    │ │   ✓ Compliance docs  │ ║
║   │   ✓ Apache 2.0       │ │   ✓ Shared timeline  │ │   ✓ SOC2 mapping     │ ║
║   │   ✓ Community support│ │   ✓ Email support    │ │   ✓ SLA + dedicated  │ ║
║   │                      │ │                      │ │     support          │ ║
║   │   [▯ Install →]      │ │   [▮ Get notified →] │ │   [▮ Contact sales →]│ ║
║   ╰──────────────────────╯ ╰──────────────────────╯ ╰──────────────────────╯ ║
║                                                                              ║
║   No lock-in. Switch tiers anytime. OSS works forever even if SaaS shuts.    ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║                              Frequently asked                                ║
║                                                                              ║
║   ╭──────────────────────────────────────────────────────────────────╮       ║
║   │ ▾ Is the OSS version really fully functional?                    │       ║
║   │                                                                  │       ║
║   │   Yes. Phase 1 ships a complete local-first product. You can    │       ║
║   │   govern AI agents end-to-end without paying us a cent.          │       ║
║   ╰──────────────────────────────────────────────────────────────────╯       ║
║                                                                              ║
║   ╭──────────────────────────────────────────────────────────────────╮       ║
║   │ ▸ Can I self-host the Enterprise features?                       │       ║
║   ╰──────────────────────────────────────────────────────────────────╯       ║
║                                                                              ║
║   ╭──────────────────────────────────────────────────────────────────╮       ║
║   │ ▸ Do you store any of my code?                                   │       ║
║   ╰──────────────────────────────────────────────────────────────────╯       ║
║                                                                              ║
║   ╭──────────────────────────────────────────────────────────────────╮       ║
║   │ ▸ When will Team / Enterprise be available?                      │       ║
║   ╰──────────────────────────────────────────────────────────────────╯       ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

- 3 colonnes (OSS / Team / Enterprise), card centrale "popular" avec liseré
- Team marqué "Phase 3" pour ne pas surpromettre
- FAQ accordion (shadcn `Accordion`)

---

## 4. Composants à construire

| Composant | Usage | Source |
|-----------|-------|--------|
| `<Button>` | tous les CTAs | shadcn/ui |
| `<Card>` | feature cards, pricing cards | shadcn/ui |
| `<Badge>` | "Phase 3", "Most popular", "Apache 2.0" | shadcn/ui |
| `<Accordion>` | FAQ pricing | shadcn/ui |
| `<CodeBlock>` | install snippets, workflow demo | custom (shiki sous le capot) |
| `<CopyButton>` | copy-to-clipboard sur snippets | custom (Lucide Copy icon) |
| `<TerminalCard>` | terminal-style snippet avec prompt $ | custom (basé sur `<Card>`) |
| `<ThemeToggle>` | dark/light switch dans nav | next-themes + shadcn |
| `<Nav>` | top sticky nav avec scroll behavior | custom |
| `<Footer>` | footer 4 colonnes | custom |
| `<ArchitectureDiagram>` | SVG inline (responsive) | custom (Figma export) |
| `<AgentLogos>` | grille logos agents | custom (SVG locaux) |

---

## 5. Plan d'implémentation site web

### Étape S1 — Bootstrap (1-2h)

- [ ] `cd site/ && npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir --import-alias "@/*" --no-turbopack`
- [ ] Installer shadcn/ui : `npx shadcn-ui@latest init` (config Geist + dark default)
- [ ] Ajouter dépendances : `pnpm add next-themes shiki lucide-react clsx tailwind-merge`
- [ ] Composants shadcn : `npx shadcn-ui@latest add button card badge accordion`
- [ ] Configurer `next.config.mjs` : `output: 'export'` + `images: { unoptimized: true }` pour static export

### Étape S2 — Layout + nav + footer (2-3h)

- [ ] `app/layout.tsx` : fonts Geist, theme provider, metadata SEO
- [ ] `<Nav>` sticky avec scroll detection, GitHub stars badge
- [ ] `<Footer>` 4 colonnes
- [ ] `<ThemeToggle>` (default dark)
- [ ] CSS globals : reset, typography Tailwind, custom colors palette

### Étape S3 — Composants atomiques (2h)

- [ ] `<TerminalCard>` avec prompt `$`, support multi-lignes
- [ ] `<CopyButton>` avec feedback visuel (icon switch Copy → Check 2s)
- [ ] `<CodeBlock>` avec highlighting shiki côté build (zero JS runtime)

### Étape S4 — Homepage sections (4-6h)

- [ ] Hero (S2.2)
- [ ] Supported agents (S2.3)
- [ ] Problem statement (S2.4)
- [ ] Features grid (S2.5)
- [ ] Workflow demo (S2.6)
- [ ] Architecture diagram — SVG inline ou `<Image>` (S2.7)
- [ ] Open source / Enterprise split (S2.8)
- [ ] Trust strip (S2.9)
- [ ] Final CTA (S2.10)

### Étape S5 — Pages secondaires (2-3h)

- [ ] `/pricing` avec 3 cards + FAQ accordion
- [ ] `/404`, `/500`
- [ ] `/docs` (placeholder ou redirect vers `docs.govforge.dev`)

### Étape S6 — Assets + SEO (2h)

- [ ] Logo SVG (wordmark + favicon)
- [ ] OG image 1200×630 (Vercel `next/og` ou Figma export)
- [ ] `robots.txt`, `sitemap.xml` (next-sitemap)
- [ ] Meta tags : title, description, canonical, og:*, twitter:card
- [ ] Logos d'agents en `public/agents/*.svg` (5-9 logos)

### Étape S7 — Build + déploiement sur `.5` (1-2h)

- [ ] `pnpm build && pnpm export` → dossier `out/`
- [ ] `infra/podman/quadlet/govforge-site.container` :
  - Image : `docker.io/caddy:2-alpine` (Caddy en mode file_server)
  - Network : `govforge.network`
  - Volume : `./out` → `/srv` (read-only)
  - Pas de port hôte (interne uniquement, accessible via Caddy reverse proxy)
- [ ] Modifier `infra/caddy/Caddyfile` : `@apex` → `reverse_proxy govforge-site:80` (au lieu de respond placeholder)
- [ ] `systemctl --user daemon-reload && start govforge-site.service`
- [ ] Test : `https://govforge.dev` → page d'accueil

### Étape S8 — CI/CD (1h)

- [ ] GitHub Actions `.github/workflows/site.yml` :
  - sur push `main` qui modifie `site/**` : build → push image GHCR `ghcr.io/ericvaillancourt/govforge-site:latest`
  - `AutoUpdate=registry` du quadlet pull la nouvelle image et restart auto

**Total estimé** : 14-19h pour un site polished + déployé.

---

## 6. Décisions ouvertes (à valider avant code)

- [ ] **Logo** : wordmark seul ou avec icône (engrenage, layers, lock, fork) ? Mockup à faire en Figma.
- [ ] **Palette couleurs accent** : bleu (générique tech), vert (validation/approval), violet (gouvernance/regal), orange (énergie) ? Recommendation = bleu sobre type Vercel/Linear pour neutralité enterprise.
- [ ] **Geist vs autre font** : Geist (Vercel, libre) ou Inter (déjà standard) ? Recommendation = Geist pour différenciation visuelle.
- [ ] **Stars GitHub badge** : live (fetch côté client) ou static au build (regen quotidienne via cron) ? Recommendation = static au build pour static export simplicity.
- [ ] **Logos agents** : utiliser logos officiels (légalement OK pour "supported by" si non altérés) ou silhouettes neutres ? Recommendation = logos officiels (style Context7 list de libraries).
- [ ] **Demo vidéo** : à produire en parallèle (asciinema = free, screencast = polish supérieur) ? Recommendation = asciinema pour le launch (suffit), screencast pour Phase 3.
- [ ] **Form contact sales** : mailto: ou Tally/Cal.com embed ? Recommendation = mailto au launch, form quand vrai pipeline B2B.

---

## 7. Hors scope du site initial

- Authentification, signup, dashboard SaaS (= Phase 3 SaaS)
- Demo interactive en ligne (sandbox MCP) — trop complexe pour un launch
- Stats publiques temps réel (decisions logged, agents active, etc.) — pas de données encore
- Internationalisation (i18n) — anglais seulement au launch
- Animation lourde (Three.js, GSAP, Framer Motion) — privilégier perf et sobriété
- Newsletter signup — cohérent avec positionnement "no tracking"

---

## 8. Critères de qualité avant publication

- [ ] Lighthouse score ≥ 95 (Performance, Accessibility, Best Practices, SEO)
- [ ] Page load < 1.5s sur 4G simulée (le static export aide énormément)
- [ ] Tous les liens `target="_blank"` ont `rel="noopener noreferrer"`
- [ ] OG image rendue correctement sur Twitter/X, LinkedIn, Slack, Discord
- [ ] Test sur mobile réel (pas juste DevTools responsive)
- [ ] Test screen reader (sections, headings hiérarchiques h1→h2→h3)
- [ ] Dark + light mode tous deux testés
- [ ] Aucune erreur console en prod build
- [ ] Aucun TODO/PLACEHOLDER dans le contenu visible
- [ ] Footer date dynamique (pas hardcoded "© 2026")
