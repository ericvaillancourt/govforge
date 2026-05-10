# Launch monitoring — first 72 hours

> **Purpose**: keep the launch from turning into a fire drill. The
> first 72 hours after Show HN goes live is when most of the signal
> arrives — both the bugs and the believers.
>
> **Mode**: hands-on for hour 0–6, attentive for hour 6–24, sampled
> after that. Set explicit walk-away windows so the launch doesn't
> swallow the week.

---

## Hour 0 — submission moment

Single thing: hit submit on Show HN.

- [ ] Tag the moment in a private notes file. Timestamp + which post
      went where, in this order:
      1. Show HN (canonical anchor)
      2. Lobsters (`https://lobste.rs/stories/new`, tags: `practices`,
         `ai`, `release`)
      3. Tweet thread (link tweet 1 to the HN URL)
      4. LinkedIn long-form (link in first comment, not body)
      5. dev.to canonical blog post
- [ ] Confirm the install path works *right now* on a fresh box:
      ```sh
      curl -fsSL https://govforge.dev/install.sh | sh
      ```
      If the install is broken at hour 0, pull the HN post until
      it's fixed. A broken install is worse than no launch.
- [ ] Pin the first technical comment under your own HN post within
      90 seconds of submitting (text in `marketing/launch/show-hn.md`).
- [ ] Tell the people who said "yes, ping me on launch day" — the
      explicit-opt-in column from the outreach spreadsheet. One
      message each, with the HN link. No group blast.

---

## Hour 0–6 — active reply window

Reply latency target: **under 10 minutes** for technical questions on
HN, under 30 minutes everywhere else. This is where comments either
turn into a thread or die. After hour 6 the velocity drops sharply
and a 4-hour SLA is fine.

Tabs to keep open:

| Channel       | What you're watching                                         | URL                                                      |
|---------------|--------------------------------------------------------------|----------------------------------------------------------|
| Hacker News   | Comments on the Show HN post                                 | (paste the post URL when live)                           |
| Lobsters      | Replies on the story                                         | (paste the story URL when live)                          |
| Twitter / X   | Replies + quote tweets on the thread                         | https://x.com/notifications                              |
| LinkedIn      | Comments on the long-form post                               | https://www.linkedin.com/notifications/                  |
| dev.to        | Comments on the canonical blog post                          | https://dev.to/dashboard                                 |
| GitHub Issues | New issues on the repo                                       | https://github.com/ericvaillancourt/govforge/issues      |
| GitHub Stars  | Star count + new starrers                                    | https://github.com/ericvaillancourt/govforge/stargazers  |
| Email         | press@ + hello@ inboxes                                      |                                                          |

Reply playbook:

- **Bug report**: thank them, file a GitHub issue, link the issue back
  in the comment, fix critical bugs *immediately* and link the commit.
  Visible responsiveness is the whole launch.
- **"Why not X?" (competitor / framing)**: link to the FAQ entry that
  answers it, then add the one-paragraph nuance the FAQ doesn't cover.
  Don't argue. Acknowledge tradeoffs.
- **"How does this differ from CodeRabbit / Sweep / Continue / etc.?"**:
  the one-line answer is "those are review tools that produce review
  output; GovForge is an audit-trail substrate that records the output
  of any reviewer — including those." Don't badmouth.
- **"This is great" / "starring"**: brief thank-you, don't over-engage.
  Velocity is currency on HN; energy spent on cheers is energy not
  spent on bugs.
- **Hostile comment**: read it twice, look for the kernel of truth,
  reply to the kernel. Don't reply to the tone. If there's no kernel,
  don't reply at all — let it sink on its own.

Stop-and-walk rule: after every 60 minutes of reply work, stand up,
walk for 5. If you're typing the same defensive paragraph for the
third time, take 30 minutes off the keyboard.

---

## Hour 6–24 — attentive but bounded

- [ ] Check each channel every 60–90 minutes.
- [ ] Triage GitHub issues by EOD. Label: `bug`, `question`, `enhancement`,
      `docs`. Reply on every issue, even if just to acknowledge.
- [ ] If HN is on the front page, post a single follow-up comment
      with whatever bug fixes shipped that day. Don't bump artificially.
- [ ] Schedule the next-day social posts (X / LinkedIn) but don't
      send them yet — they're for hour 24+.
- [ ] Sleep. The follow-up posts will not save a launch that lost the
      first day to exhaustion.

---

## Hour 24–72 — second wave

This is where the long tail picks up. Newsletters, podcasts, and
re-shares hit the second day, not the first.

- [ ] Post the dev.to canonical blog (if not posted at hour 0).
- [ ] Cross-post the blog to Medium with `canonical_url` pointing at
      dev.to.
- [ ] Reach out to 2–3 newsletter authors who covered adjacent
      launches recently. Subject: "GovForge launched yesterday —
      thread context if useful". Link the HN post and the repo.
- [ ] Submit to the MCP registry / community catalogue (see
      `docs/release.md` §Registries).
- [ ] Reply to GitHub Discussions threads opened in the first 24h.
- [ ] Send a short retro update on Twitter at hour ~30: "1 day in:
      X stars, Y issues filed, Z bugs fixed. Threads I'm chewing on
      from feedback: …". Specific and humble beats triumphant.

---

## Metrics worth tracking — and the ones that aren't

Capture in `marketing/launch/launch-metrics.md` (private file). The
honest version of the launch retro lives here.

**Worth tracking** (signal of real adoption):

- GitHub stars in the first 72h (loose proxy for reach).
- GitHub clones in the first 72h (proxy for *intent* — far stronger
  than stars). View at https://github.com/ericvaillancourt/govforge/graphs/traffic.
- New GitHub issues, broken down by bug / question / enhancement.
- New GitHub Discussions threads.
- Install attempts → successful runs (if you wire telemetry-free
  install logging on `install.sh`, e.g. via Caddy access logs by
  user-agent only — no IPs, no payloads).
- HN front-page peak rank.
- Inbound emails to press@ + hello@.

**Not worth obsessing over**:

- Twitter likes. They're a vanity metric and they don't translate.
- HN points if the post is on page 2+. Below ~30 points the noise
  drowns the signal.
- "Did anyone famous tweet it." If they did, great; you can't make
  it happen by checking 47 times.

---

## Stop conditions — when to call the launch done

Pre-commit to these so the launch has a known end. Without an end,
it eats the whole quarter.

- **Hard stop**: 72 hours after submission, regardless of momentum,
  switch out of "active reply" mode and back to normal cadence.
- **Soft stop**: when you've replied to every HN comment and every
  open GitHub issue at least once. After that, replies are normal
  open-source maintenance, not a launch task.
- **Emergency stop**: critical security report. Pull the HN post
  if necessary, switch entirely to coordinated disclosure on
  SECURITY.md, treat the launch as paused until the fix ships.

---

## 7-day post-mortem

A week after launch, write a short retro in `docs/launch-retro.md`
(private at first, can be made public later if interesting):

- What surprised you? (Both directions — bugs and praise.)
- Which channel actually drove installs? (Stars are noisy; clones
  and install-script hits are the real number.)
- Which framing landed? Which fell flat?
- One thing to do differently for v0.2's launch.
- One thing to keep doing exactly the same.

The retro is the most valuable artefact of the launch. The traffic
ends; the lessons compound.
