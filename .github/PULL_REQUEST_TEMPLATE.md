<!--
  Thanks for the contribution! Please fill the sections below — the
  Test plan section is mandatory. See CONTRIBUTING.md for the full
  rules.
-->

## Summary

<!-- 1–3 bullet points: what this PR does, in plain language. -->

-
-

## Why

<!-- The problem you're solving. Link an issue or Discussion if there's one. -->

Closes #

## How

<!--
  The shape of the change. Mention any new abstraction, any contract
  change at a package boundary, and any deliberate trade-off (e.g.
  "Phase 1 trade-off: …").
-->

## Test plan

<!--
  Mandatory. Bulleted checklist of what you verified. Include the
  commands you ran. Examples:

  - [ ] `cd backend && pytest -q` — 97 → 102 passed
  - [ ] `cd cli && go test -race ./...` — clean
  - [ ] `cd ui && npm run build` — clean
  - [ ] Manually verified `gf decision timeline DEC-001` shows the new event
-->

- [ ]
- [ ]

## Scope checklist

- [ ] No subprocess / shell-out from MCP code (see [threat model](../docs/threat-model.md))
- [ ] No new write-side Git verb in `core.git`
- [ ] No `eval` / `exec` introduced anywhere
- [ ] Backend coverage stays ≥ 80 %, Go CLI coverage stays ≥ 70 % per package
- [ ] Updated `CHANGELOG.md` if user-facing
- [ ] Updated relevant docs (`docs/`, package README, `CONTRIBUTING.md`)

## Screenshots / output

<!-- Optional. CLI output snippets, cockpit screenshots, OG previews, etc. -->
