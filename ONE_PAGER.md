# Microclime

**Your garden has its own weather.**

NextStep Hacks 2026 — theme: Earth Forward
Built by Christian Saterfield

---

## The problem

Weather apps report the forecast for your whole zip code. They have no idea
that the back corner of your garden is shaded by a neighbor's tree until 11am,
or that a specific spot sits in a cold trap that frosts hours before the
official forecast does. People lose plants, waste water, and plant in the
wrong place because the only weather data they have access to isn't actually
about their spot.

## What Microclime does

Point your phone at one exact spot in your garden and Microclime tells you,
hour by hour, what the sun and cold actually do there — not what they do
across your whole zip code.

1. **Real sun-hours engine.** Actual solar-position astronomy (not an API —
   real trigonometry) combined with a horizon read automatically from your
   photo's pixels, producing an hour-by-hour sun/shade chart for any date.
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
5. **Multi-zone mapping.** Save several spots around your garden and they're
   automatically grouped into Full sun / Partial sun / Mostly shade zones,
   each with a real planting suggestion.
5b. **Spot-vs-spot comparison.** Thinking of moving a plant? Photograph the
   other spot you're considering and get a real head-to-head verdict —
   which one gets more sun, which one is less likely to get sunburned —
   computed with the exact same math and the same day's weather as the
   original spot, tied to whichever plant you've selected.
6. **Neighborhood microclimate map (concept demo).** If people nearby used
   it too, spots would combine into a shared map more accurate than any
   single weather station. Building the real multi-user version was out of
   scope for a solo build on this timeline, so this is shown as a working
   demo with seeded data alongside your real computed numbers.
7. **Tap-to-pick plant advice that always works.** Pick what's growing there
   from a plant list and get sun-adequacy, a real watering amount and
   timing, sunburn risk, and frost risk (called out by name for
   frost-sensitive plants) — all deterministic, computed from this spot's
   real numbers, no AI guess required. Prefer a close-up photo instead?
   Take one of the actual plant (not the wide horizon shot — there's
   nothing plant-like to recognize in a skyline photo) and AI identifies it
   and tailors the same advice to that species.
8. **"Where should I plant this?" (optional, tucked away).** Name a plant
   and it ranks every spot you've saved by how well each one's real
   computed sun-hours fits that plant's known needs — deterministic
   comparison against real numbers, not an AI guess. It's a real, working
   feature, just not the headline one: the main flow is about the spot
   you're already standing at, not scouting a new one.

Real location auto-detection throughout: a live photo grabs your device's
GPS automatically, and an uploaded photo reads its location straight out of
its EXIF metadata — location only needs to be typed manually as a fallback.
Every result also opens with an AI-generated plain-English summary, so the
technical hour-by-hour table is optional detail, not the first thing shown.

No login. No accounts. Everything lives in your browser.

## Why this is the right kind of original

Two earlier ideas for this hackathon — and a plant-diagnosis app idea after
that — all turned out to already exist as mature, funded products once we
actually checked. Sun-mapping for gardens exists too (apps like SASHA and
Coffee in the Sun already do "how much sun does my garden get"), so we don't
claim that piece is new. What we built on top of it is: a frost/heat model
that adjusts for the specific spot's actual conditions, a self-calibrating
correction loop, and a what-if simulator for testing planting decisions
before committing to them. That combination doesn't exist elsewhere, and the
AI's role is a supporting one — explaining results in plain language — not
the core mechanic.

There are also plenty of apps that point a camera at a plant and give an AI
diagnosis of how much attention it currently needs — that category is
genuinely crowded. What none of them do is narrow all the way down to the
plant's *exact physical position* and estimate how much sun that specific
spot will actually get, hour by hour, on any given day. A generic
"water twice a week" diagnosis doesn't know that this particular plant sits
in a cold trap that frosts before the forecast does, or gets four hours of
scorching, unblocked afternoon sun that a plant ten feet away never sees.
Microclime's whole engine exists to answer that one question — real
sun-hours for one real spot — and everything else (frost risk, heat-stress
watering windows, the AI plant identification, "where should I plant this"
ranking, calibration over time) is built on top of that real,
location-specific number. The goal isn't a
one-time diagnosis; it's sustained outdoor plant, grass, and tree health —
watered enough, not sunburned, not caught by frost — based on what that
exact spot's sun and weather are actually doing, not a generic care sheet.

## How it stacks up against the judging criteria

- **Originality** — the core building block (sun mapping) isn't new; the
  frost model, self-calibration, and what-if layer built on top are.
- **Adherence to Earth Forward** — directly about growing food and plants
  more efficiently, reducing water waste and frost losses.
- **Completion** — all core phases plus the AI plant ID, plant-placement
  ranking, and plain-English summary layers are built, tested, and working;
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
The app's core logic — sun-hours, frost/heat risk, calibration, zone
classification, and the plant-placement ranking math — is entirely
deterministic code we wrote ourselves; no AI model touches it. Google
Gemini (via its OpenAI-compatible API) powers three specific, supporting
features on top of that real data: identifying a plant from a photo and
tailoring advice to it, looking up a named or photographed plant's general
sun-need range (used only as an input to the deterministic ranking, never
the ranking decision itself), and generating a plain-English summary of
the already-computed results. All three are fed the real numbers as
context and instructed never to invent or contradict them; none of them
make the underlying decisions.

## Try it

Live: https://microclime.vercel.app
Source: https://github.com/csater1026-rgb/microclime
