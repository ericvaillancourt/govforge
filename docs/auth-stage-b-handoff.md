# Phase 3.0 Stage B — handoff checklist

> **Status: GitHub-only flow is LIVE since 2026-05-10.** See
> `infra/RUNBOOK.md` §8.5 for the operational runbook. This file
> now tracks the **remaining** handoffs needed for Google OAuth and
> the Resend-backed magic link, which still 503-stub on prod.

## ✅ Done — GitHub OAuth (live)

1. GitHub OAuth app registered, callback `https://api.govforge.dev/auth/github/callback`
2. `GITHUB_OAUTH_CLIENT_ID` + `GITHUB_OAUTH_CLIENT_SECRET` + `GOVFORGE_COOKIE_SECRET` + `GOVFORGE_COOKIE_DOMAIN=.govforge.dev` deployed to `~/govforge/backend/backend.env` on `.5`
3. `accounts` + `sessions` tables created via `create_all`
4. Smoke-tested: `/auth/github/start` returns `302` with `redirect_uri=https://…`

## What Eric still needs to do for the follow-ups

### 1. (DONE — kept for reference) Register the GitHub OAuth app

1. https://github.com/settings/developers → **New OAuth App**
2. Fields:
   - **Application name**: `GovForge` (or `GovForge Dev` if registering a separate app for dev)
   - **Homepage URL**: `https://govforge.dev`
   - **Application description**: Short — e.g. "Governance infrastructure for AI coding agents."
   - **Authorization callback URL**: `https://api.govforge.dev/auth/github/callback`
3. After creation:
   - Copy the **Client ID** → `GITHUB_OAUTH_CLIENT_ID`
   - Click **Generate a new client secret** → `GITHUB_OAUTH_CLIENT_SECRET` (shown once)
4. (Optional) Register a SECOND app for local dev with callback `http://localhost:8787/auth/github/callback`.

### 2. Register the Google OAuth app

1. https://console.cloud.google.com/ → create or pick a project
2. **APIs & Services** → **OAuth consent screen**:
   - User type: External
   - App name: `GovForge`
   - User support email: `eric.vaillancourt@talsom.com`
   - Authorized domains: `govforge.dev`
   - Scopes: `email`, `profile`, `openid`
   - Test users (while in "Testing" mode): your own email at minimum
3. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**:
   - Application type: Web application
   - Authorized JavaScript origins: `https://govforge.dev`, `https://api.govforge.dev`
   - Authorized redirect URIs: `https://api.govforge.dev/auth/google/callback`
4. After creation:
   - Copy the **Client ID** → `GOOGLE_OAUTH_CLIENT_ID`
   - Copy the **Client Secret** → `GOOGLE_OAUTH_CLIENT_SECRET`

> Google's OAuth screen stays in "Testing" mode (only allowlisted users) until you submit it for verification. For Stage B beta, testing mode is enough — verification can come later.

### 3. Sign up for an email provider (magic-link fallback)

Recommended: **Resend** (simpler than Postmark, cheaper at low volume).

1. https://resend.com → sign up
2. **Domains** → add `govforge.dev` → follow the DNS records (TXT + MX + DMARC) — set them on Cloudflare zone `govforge.dev`
3. Wait for verification (typically <10 min)
4. **API Keys** → create a new key with "Sending access" → `RESEND_API_KEY`
5. Decide on the from address: `noreply@govforge.dev` is conventional.

### 4. Generate a cookie signing secret

```bash
python -c 'import secrets; print(secrets.token_urlsafe(48))'
```

→ `GOVFORGE_COOKIE_SECRET` (32+ random bytes, never rotate without invalidating all sessions).

### 5. Drop everything into `~/govforge/backend/backend.env` on `.5`

Add these lines (chmod 600 on the file):

```env
# Stage B — OAuth login
GITHUB_OAUTH_CLIENT_ID=...
GITHUB_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...

# Stage B — magic link
RESEND_API_KEY=...
RESEND_FROM_EMAIL=noreply@govforge.dev

# Stage B — sessions
GOVFORGE_COOKIE_SECRET=...
GOVFORGE_COOKIE_DOMAIN=.govforge.dev   # leading dot covers api.govforge.dev too
```

> The same env vars get added to `infra/.env.example` (already prepped — see the commented-out `Phase 3` section).

### 6. Confirm the bootstrap admin token still works

If Stage A is already deployed, you should already have an admin token from running:

```bash
podman exec -it govforge-backend \
  python -m govforge.scripts.bootstrap_admin \
  --email eric.vaillancourt@talsom.com \
  --display-name Eric --ensure-tables
```

The token is reusable for ops work even after Stage B lands.

---

## What Stage B coding will produce

Backend:
- `Account` model (1 row per OAuth provider linked to a user)
- `Session` model (cookie-backed, opaque token, indexed by hash)
- `RequireUser` dependency (cookie path) parallel to existing `RequireToken`
- `RequireUserOrToken` for endpoints called from both site and CLI
- Routes: `/auth/github/{start,callback}`, `/auth/google/{start,callback}`,
  `/auth/magic/{request,callback}`, `/auth/{session,logout}`
- CSRF state for OAuth handshakes (signed cookie)
- CORS extended for `https://govforge.dev` with `credentials=true`

Site:
- `/[lang]/login` — three buttons (GitHub / Google / Magic link form)
- `/[lang]/auth/callback` — receives session cookie, redirects to `/account`
- `/[lang]/account` — user profile + token list + "create token" form (with scope checkboxes)
- Auth-aware nav: avatar + "Sign out" when signed in, "Sign in" when not
- Bilingual EN/FR for every new screen

CLI:
- `gf auth login` — device code flow:
  1. `POST /auth/device/code` → `{user_code, verification_uri, interval}`
  2. CLI prints "Visit https://govforge.dev/login/device + enter code XXXX"
  3. CLI polls `POST /auth/device/token` until success
  4. Token stored in `.govforge/auth.toml` (chmod 600)
- `gf auth logout` — deletes the local file
- `gf auth whoami` — pings `/auth/session` and prints user info
- `gf token create --agent <type> --label <name> --scopes a,b,c` — uses Bearer
- `gf token list` / `gf token revoke <id>`
- All existing `gf` commands include `Authorization: Bearer <token>` from `.govforge/auth.toml`

---

## Estimated Stage B effort once creds are in hand

| Chunk | Days | Blocking? |
|---|---|---|
| Models + DB migration | 0.5 | — |
| OAuth router + state + CSRF | 2 | needs creds |
| Magic link router + email send | 1 | needs Resend key |
| Cookie auth dep + cross-origin config | 1 | — |
| Site `/login` + `/account` UI bilingual | 3 | — |
| `gf auth login` device flow | 2 | — |
| `gf token` commands | 1 | — |
| Tests (auth flows, tokens via UI, CLI) | 1 | — |
| Smoke test extensions | 0.5 | — |
| **Total** | **~12 days focused** | |

Estimate is end-to-end including deploy and verification. Realistic
calendar window with part-time focus: ~3 weeks.
