# GovForge UI Cockpit

Local UI cockpit for viewing decisions, timelines, policies, reviews, and approvals.
Spawned by `gf ui serve` (or `npm run dev` during development).

> **Scope** — this is the **local cockpit** that runs on a developer's machine
> alongside the GovForge backend. The **public marketing site** is in `../site/`.
> Different apps, different audiences, different builds.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4
- TanStack Query 5 — fetch + cache + mutation invalidation
- `lucide-react` — icons
- `clsx` + `tailwind-merge` — class composition
- `next-themes` — light/dark (declared, not yet wired into a toggle)

> **Note** — the Phase 1 cockpit uses plain Tailwind utility classes with a
> small `cn()` helper rather than full `shadcn/ui`. The marketing site under
> `../site/` does use shadcn; the cockpit deliberately stays leaner so the
> binary is faster to build and easier to skin.

## Setup

```bash
cd ui
npm ci
npm run dev      # http://localhost:8788
```

Requires the GovForge HTTP API running at `http://127.0.0.1:8787` (started by
`gf api serve` from the project root).

Override the API base URL via env:

```bash
NEXT_PUBLIC_GOVFORGE_API=http://my-host:9000 npm run dev
```

## Build

```bash
npm run type-check     # tsc --noEmit
npx eslint .
npm run build          # next build (Turbopack)
npm start              # next start --port 8788
```

## Pages

| Route                     | What it shows                                                              |
|---------------------------|----------------------------------------------------------------------------|
| `/`                       | Dashboard — pending decisions, open reviews, active tasks, recent feed     |
| `/tasks`                  | Task list                                                                  |
| `/tasks/[id]`             | Task detail + linked decisions                                             |
| `/decisions`              | Decision list                                                              |
| `/decisions/[id]`         | **The big page** — summary, rationale, git change, policies, reviews, approval, timeline |
| `/reviews`                | Review list (with All / Open-only filter)                                  |
| `/reviews/[id]`           | Review detail with structured findings                                     |

## Layout

```
ui/
├── package.json
├── next.config.ts
├── tsconfig.json
├── eslint.config.mjs
├── postcss.config.mjs
└── src/
    ├── app/
    │   ├── layout.tsx                    # QueryProvider + Nav + container
    │   ├── globals.css                   # Tailwind v4 + cockpit colour tokens
    │   ├── page.tsx                      # Dashboard
    │   ├── tasks/{page,[id]/page}.tsx
    │   ├── decisions/{page,[id]/page}.tsx
    │   └── reviews/{page,[id]/page}.tsx
    ├── components/
    │   ├── QueryProvider.tsx             # TanStack Query client
    │   ├── Nav.tsx                       # top bar + section links
    │   ├── ProjectSwitcher.tsx           # `<select>` over /projects, localStorage
    │   ├── EmptyProject.tsx              # RequireProject wrapper
    │   ├── StatusBadge.tsx               # pill for status / risk / severity
    │   ├── Timeline.tsx                  # vertical event list with lucide icons
    │   └── ApprovalActions.tsx           # Approve / Reject buttons + comment field
    └── lib/
        ├── api.ts                        # typed fetch wrapper, mirrors backend Pydantic
        ├── project.ts                    # useCurrentProject hook (localStorage)
        └── cn.ts                         # clsx + tailwind-merge helper
```

## Phase 1 trade-off — Diff Viewer

`react-diff-viewer-continued` is in `package.json` for Phase 2; the Phase 1
cockpit shows the **Git change** panel (commit hash + branch + files +
insertions/deletions) but not the line-by-line diff. The backend doesn't
expose raw diff text yet — the route `/decisions/{id}/diff` is queued for
Phase 2.

## License

Apache 2.0 — see [`../LICENSE`](../LICENSE).
