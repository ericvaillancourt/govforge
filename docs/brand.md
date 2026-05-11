# Brand Guide — GovForge

> Sober infrastructure brand. The product is plumbing for AI coding
> agents — the visual identity should feel closer to a CI runner than
> to a chat UI.

## Name & wordmark

- **Product name** — `GovForge`. Always one word. Never `Gov-Forge`,
  `Gov forge`, `govforge`, or `GOVFORGE`.
- **CLI** — `gf` (lowercase, two letters).
- Default casing in body copy: "GovForge". In code blocks it stays
  exact-case (`GovForge`, `gf`).

The wordmark uses a sans-serif (Geist / Inter / system) at semi-bold
with `-0.02em` letter-spacing.

## Tagline

```
Govern AI coding agents before they govern your codebase.
```

That's the canonical English tagline. The French marketing site at
`govforge.dev/fr/` uses an idiomatic translation of the same idea —
not a literal calque.

## Logo

Three asset variants live in [`brand/`](../brand/):

| File              | When to use                                                      |
|-------------------|------------------------------------------------------------------|
| `mark.svg`        | Stroked mark on a coloured surface (nav, dark hero, card chrome) |
| `mark-filled.svg` | Solid mark — favicons, app tiles, OG image                       |
| `wordmark.svg`    | Mark + "GovForge" lockup — README header, email signature        |

All three SVGs use `fill="currentColor"` / `stroke="currentColor"` so a
single file adapts to whatever text colour the surrounding context uses.
No need for a separate light + dark export.

### Clear space

Reserve at least the height of the rounded square as breathing room on
all four sides. At 32 px favicon size this is intuitive; at 64 px+ keep
the square at least 16 px clear of any surrounding edge or text.

### Don't

- Don't recolour individual paths. The mark is monochrome.
- Don't put the wordmark on a busy photographic background. Use the
  solid `mark-filled.svg` instead.
- Don't outline the wordmark text — it's already at semi-bold. Use the
  raw SVG, not a screenshot.
- Don't rotate, skew, or stretch any of the assets.

## Palette

The cockpit and the marketing site share one accent. Everything else is
grayscale — this is intentional, and matches the "infrastructure" tone.

| Token        | Light                       | Dark                         |
|--------------|-----------------------------|------------------------------|
| Background   | `#ffffff` / `hsl(0 0% 100%)`| `hsl(222 47% 7%)`            |
| Foreground   | `hsl(222 47% 11%)`          | `hsl(210 40% 98%)`           |
| Muted bg     | `hsl(210 40% 96%)`          | `hsl(217 32% 17%)`           |
| Border       | `hsl(214 32% 91%)`          | `hsl(217 32% 22%)`           |
| Accent       | `hsl(221 83% 53%)`          | `hsl(217 91% 60%)`           |
| Success      | `hsl(142 71% 45%)` (both modes)                            |
| Warning      | `hsl(38 92% 50%)`  (both modes)                            |
| Danger       | `hsl(0 84% 60%)`   (both modes)                            |

These tokens are wired into both the cockpit (`ui/src/app/globals.css`)
and the marketing site (separate repo). Don't introduce a second accent
without updating both.

## Typography

- **Sans-serif body & UI** — Geist Sans, falling back to the system
  stack: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
  "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`.
- **Mono** — Geist Mono / `ui-monospace, SFMono-Regular, Menlo, Consolas,
  Liberation Mono, monospace`. Used for command snippets, display IDs
  (`TASK-001`), and commit hashes.
- **Heading sizes** — `text-2xl` for page titles in the cockpit (24 px),
  `text-3xl` and up for hero sections on the marketing site.
- **Letter-spacing** — `-0.02em` on the wordmark and large headings;
  default everywhere else.

## Tone of voice

- **Engineering, not hype.** "Auditable", "deterministic", "read-only"
  are warmer than "AI-powered" or "intelligent".
- **Noun-first headlines.** "Governance for AI coding agents" beats
  "We help you govern AI coding agents".
- **No emoji in product copy.** OK on social posts, never in the docs
  or in CLI output.
- **English is canonical.** The French site is a translation, not a
  fork — wording changes start in `en.json` and propagate to `fr.json`.

## Domain & handles

| Channel              | Handle                                                  |
|----------------------|---------------------------------------------------------|
| Apex                 | `https://govforge.dev/`                                 |
| GitHub               | `https://github.com/ericvaillancourt/govforge` (transfer to a `govforge` org planned) |
| PyPI package         | `govforge` (reserved with the first `0.1.0` release)    |
| npm wrapper          | `govforge` (reserved with the CLI release)              |
| Homebrew tap         | `ericvaillancourt/homebrew-tap` (current); will move to `govforge/homebrew-tap` post-org-transfer |
| Subdomains           | `docs.`, `app.`, `api.`, `mcp.` (Phase 3 placeholders)  |

## Asset checklist

- [x] Mark (stroked + filled variants)
- [x] Wordmark
- [x] Favicon (marketing site, generated at build)
- [x] OG image (marketing site, 1200×630)
- [ ] Apple touch icon — uses the favicon for now; raster export
      pending.
- [ ] Animated demo GIF/MP4 for the README hero — Workstream M.

When you ship a new asset, drop it in [`brand/`](../brand/) and link it
here. Don't sprinkle one-off logos around the codebase. (Marketing-site
assets that aren't reused elsewhere can live in the site repo's
`public/brand/`.)
