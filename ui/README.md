# GovForge UI Cockpit

Local UI cockpit for viewing decisions, timelines, diffs, policies, and approvals. Spawned by `gf ui serve`.

> **Note** : this is the **local cockpit** that runs on a developer's machine alongside the GovForge backend. The **public marketing site** is in `../site/`. Different apps, different scopes.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4
- shadcn/ui (Base UI)
- TanStack Query (data fetching from local API)
- `react-diff-viewer-continued` (diff display)
- `next-themes` (dark/light)

## Setup

```bash
cd ui
npm install
npm run dev      # starts on http://localhost:8788
```

Requires the GovForge HTTP API running at `http://127.0.0.1:8787` — usually started by `gf api serve`.

## Build

```bash
npm run build
npm start        # production server on :8788
```

## Layout

```
ui/
├── package.json
├── next.config.ts
├── src/
│   └── app/
│       ├── layout.tsx
│       ├── page.tsx                  # dashboard
│       ├── tasks/[id]/page.tsx
│       ├── decisions/[id]/page.tsx
│       ├── reviews/[id]/page.tsx
│       └── policies/page.tsx
└── ...
```

(To be implemented in Workstream I.)

## License

Apache 2.0 — see [`../LICENSE`](../LICENSE).
