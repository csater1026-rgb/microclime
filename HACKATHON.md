# NextStep Hacks 2026 — submission notes (source of truth)

This file exists so this hackathon's rules and deadline survive across every
future Claude session working on this repo. Read this first.

## The hackathon

- **Name:** NextStep Hacks 2026, run by HackAlphaX.
- **Theme:** "Earth Forward" — environmental/climate/sustainability tech.
- **Deadline: Sep 20, 2026 @ 3:00pm MDT.** (Originally Aug 21–Sep 13, extended
  by one week.)
- Online, public, beginner-friendly. Ages 13+, students only, all
  countries/territories (standard exceptions apply).
- $1,750+ in cash prizes: 1st $1,000 (+$500 Claude credits, YC interview,
  AOPS coupons, XYZ domains, a year of NordVPN/NordPass/Saily/Incogni), 2nd
  $500, 3rd $250 (scaled-down versions of the same extras), plus 700
  participation prizes (Wolfram Alpha access, XYZ domains).
- Judging criteria: **Originality, Adherence to "Earth Forward," Completion,
  Learning, Design, Technology.**

## Submission requirements (all required)

1. A **video demo/pitch, ≤ 5 minutes**.
2. A link to the **repository/code**.
3. A link to the **live site/app** (if applicable).
4. If continuing an old project: must state in the Devpost submission what
   was done **before** vs **during** the hackathon window.
   - **Not applicable here** — this repo's first real commit is
     **2026-08-23**, inside the (extended) hackathon window. Everything in
     this repo was built during the hackathon. Say so plainly in the
     Devpost submission if asked.
5. Submitting to other hackathons this month is allowed, only if the other
   hackathon also allows it.

## This project's status against those requirements

- **Live site:** ✅ https://microclime.vercel.app
  (production domain; the old `*.vercel.app` preview URL is SSO-locked).
- **Repo:** ✅ `csater1026-rgb/microclime` (this repo), public.
- **Write-up/description:** ✅ `DEVPOST.md` has paste-ready, current copy for
  every Devpost form field (tagline, Built With, story). `README.md` and
  `ONE_PAGER.md` are also up to date with the current app.
- **Demo video:** ⚠️ **Stale — needs re-recording before submission.** The
  existing cut (~3:56, `demo-assets/` has the real photo + raw narration
  audio it was built from) shows the OLD UI: the pre-redesign 8-step intro,
  "yard" wording, the old broken plant-ID auto-trigger, no frost-aware
  plant advice. All of that has since been rebuilt (see history below).
  The video no longer represents the live site and should be re-recorded
  against the current UI before final submission.

## Build history (Claude Code + Cursor, same repo, same night)

Rough chronological summary, newest last:

1. Claude Code: fixed the real horizon-detection bug (global best-split
   algorithm was picking the wrong line on real photos; then a second bug
   where sunset sky color fooled the edge scan) — verified against the
   user's real backyard photo, both fixes live.
2. Claude Code: stopped auto-identifying plants from the wide horizon
   photo (the actual cause of a tester's "plant ID never works" report) —
   close-up photo only; typed plant name became the reliable path.
3. Cursor: full UX rework — photo-first flow, a sun-path-on-photo overlay,
   a plain "X hours / full-sun|partial|shade" verdict card, a tap-to-pick
   plant list that always works (no AI dependency), collapsed the 8-step
   intro to 3 steps, hid heading/FOV/what-if behind optional details.
4. Claude Code: merged Cursor's rework, resolved conflicts, standardized
   all copy on "garden" (dropped "yard"/"field"), fixed a mobile header
   wrapping bug.
5. Cursor: fall theme (brown page background, cream cards stay cream,
   deeper burnt-orange titles) + phone-optimized layout (44px tap targets,
   stacked buttons, safe-area padding). Claude Code applied the CSS-only
   handoff without touching the "garden" wording or `app.js`.
6. Claude Code: extended the tap-to-pick plant advice to cover what
   actually matters per direct feedback — sun adequacy, a real watering
   AMOUNT (not just timing), sunburn risk, and frost risk called out by
   plant name — and demoted the "compare my saved spots" ranking tool to
   an optional collapsed block instead of the main flow.
7. Claude Code: full copy audit — removed two pieces of stale/orphaned
   markup (`#results-summary`/`#risk-summary`, dead since the verdict-card
   redesign; a leftover step-badge "6" on the neighborhood panel from the
   old 6-step nav), fixed remaining "yard"/"where you want to plant"
   language across the app AND the AI system prompts in `api/*.js`, and
   brought `README.md`/`DEVPOST.md` in line with the current app instead
   of describing the pre-redesign version.

## Immediate priority given the Sep 20 3:00pm MDT deadline

1. **Re-record the demo video** against the current live UI — this is the
   one piece of the submission that's actually out of date right now.
2. Upload the video to YouTube (Unlisted), get the watch link.
3. Confirm the live Vercel URL is current/production before submitting.
4. Submit on Devpost using `DEVPOST.md` — it already has every field
   written and current, just needs the video link pasted in.
