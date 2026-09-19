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

- **Live site:** ✅ https://microclime-3emkrlicx-csater1026-rgbs-projects.vercel.app/
  (confirm this URL is still current before final submission — Vercel
  preview URLs can change on redeploy; check the project's production
  domain in the Vercel dashboard).
- **Repo:** ✅ `csater1026-rgb/microclime` (this repo), public.
- **Demo video:** In progress as of 2026-09-19. A full narrated walkthrough
  (~3:56, under the 5-minute cap) already exists, built via a scripted
  Playwright screen-recording + the user's own recorded narration audio,
  mixed together. As of the last session working on it:
  - Still using a **synthetic canvas-drawn yard photo** instead of a real
    one — user said they'd send a real photo to re-run the horizon
    auto-tracer on, and the video should be re-rendered with it before
    final submission.
  - The date shown in the app during the recording was a fixed placeholder
    (`2026-06-21`) — user asked for this to reflect the **actual current
    date** instead, to look less obviously staged. Needs to change before
    the final re-render.
  - User asked to cut "three words" out of the narration audio right before
    a pause around the 3:14 mark — the exact words were never given, so this
    edit is still outstanding (low priority vs. the photo/date fixes given
    the deadline).
- **Write-up/description:** README.md and ONE_PAGER.md in this repo already
  cover the problem, solution, features, build phases, and stack — this
  content can be pasted almost directly into the Devpost submission's
  "story" field.

## Immediate priority given the Sep 20 3:00pm MDT deadline

1. Get the real yard photo from the user, re-run the demo recording with it.
2. Update the recording to show today's real date instead of the fixed
   `2026-06-21`.
3. Re-mux narration audio onto the re-recorded video, verify it's still
   under 5 minutes, deliver it.
4. Confirm the live Vercel URL is current/production (not a stale preview
   deploy link) before submitting.
5. Submit on Devpost: video link + repo link + live site link + write-up
   (adapted from README/ONE_PAGER) + note that the whole project was built
   Aug 23–Sep 20, entirely within the hackathon window.
