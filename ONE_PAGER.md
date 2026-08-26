# Microclime

**Your yard has its own weather.**

NextStep Hacks 2026 — theme: Earth Forward
Built by Christian Saterfield

---

## The problem

Weather apps report the forecast for your whole zip code. They have no idea
that the back corner of your yard is shaded by a neighbor's tree until 11am,
or that a specific spot sits in a cold trap that frosts hours before the
official forecast does. People lose plants, waste water, and plant in the
wrong place because the only weather data they have access to isn't actually
about their spot.

## What Microclime does

Point your phone at one exact spot in your yard and Microclime tells you,
hour by hour, what the sun and cold actually do there — not what they do
across your whole zip code.

1. **Real sun-hours engine.** Actual solar-position astronomy (not an API —
   real trigonometry) combined with a horizon you trace yourself from a
   photo, producing an hour-by-hour sun/shade chart for any date.
2. **Frost and heat risk, not just a forecast.** Live weather data is
   adjusted for radiative cooling (clear, calm, dry nights cool fastest) and
   for how much sun that specific spot actually got that day — a shadier
   spot holds less heat overnight.
3. **Self-calibration.** Log what you actually observed and the model
   learns a correction for your exact spot, getting more accurate the more
   you use it instead of staying a static one-time prediction.
4. **What-if simulation.** Save your horizon as "how it is now," then edit
   the trace to test an idea — add a bump for a tree you're considering
   planting, flatten a spot for one you'd trim back — and see exactly what
   it would change before you touch a shovel.
5. **Multi-zone mapping.** Save several spots around your yard and they're
   automatically grouped into Full sun / Partial sun / Mostly shade zones,
   each with a real planting suggestion.
6. **Neighborhood microclimate map (concept demo).** If people nearby used
   it too, spots would combine into a shared map more accurate than any
   single weather station. Building the real multi-user version was out of
   scope for a solo build on this timeline, so this is shown as a working
   demo with seeded data alongside your real computed numbers.

No login. No accounts. Everything lives in your browser.

## Why this is the right kind of original

Two earlier ideas for this hackathon — and a plant-diagnosis app idea after
that — all turned out to already exist as mature, funded products once we
actually checked. Sun-mapping for gardens exists too (apps like SASHA and
Coffee in the Sun already do "how much sun does my yard get"), so we don't
claim that piece is new. What we built on top of it is: a frost/heat model
that adjusts for the specific spot's actual conditions, a self-calibrating
correction loop, and a what-if simulator for testing planting decisions
before committing to them. That combination doesn't exist elsewhere, and the
AI's role is a supporting one — explaining results in plain language — not
the core mechanic.

## How it stacks up against the judging criteria

- **Originality** — the core building block (sun mapping) isn't new; the
  frost model, self-calibration, and what-if layer built on top are.
- **Adherence to Earth Forward** — directly about growing food and plants
  more efficiently, reducing water waste and frost losses.
- **Completion** — all five core phases are built, tested, and working;
  the community layer is honestly labeled as a concept demo, not oversold.
- **Learning** — real solar-position astronomy, image-based horizon
  tracing, a radiative-cooling estimate, and a self-calibrating feedback
  loop — several genuinely new technical areas, not one AI call in a UI.
- **Design** — plain-language explanations throughout (no unexplained
  jargon), mobile-friendly, and a from-scratch visual design.
- **Technology** — several distinct hard components working together:
  astronomy, computer-vision-style horizon tracing, live weather data,
  a physically-motivated risk model, and a learning correction loop.

## Stack

Plain HTML, CSS, and vanilla JavaScript — no framework, no build step.
Live weather from Open-Meteo's free API. Everything else — the solar-position
math, the horizon tracing, the risk model, the calibration, the zone
clustering — is code we wrote, not a third-party service. Data lives in
the browser (`localStorage`) only; no accounts, no server-side database.

## AI use disclosure

Claude Code (Anthropic) was used as a coding assistant throughout the build.
No AI model powers the app's core logic — the sun-hours, frost/heat risk,
calibration, and zone classification are all deterministic calculations we
wrote ourselves.

## Try it

Live: https://microclime-3emkrlicx-csater1026-rgbs-projects.vercel.app/
Source: https://github.com/csater1026-rgb/microclime
