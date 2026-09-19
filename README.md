# Microclime — how much sun does this spot get?

**NextStep Hacks 2026 submission (theme: Earth Forward).**

Live: https://microclime.vercel.app

> Weather apps report your whole zip code. Microclime tells you the sun,
> water, and frost story for one exact spot in your garden — using a photo
> of your real horizon, not a generic average.

## The idea

The back corner of your garden, shaded by a neighbor's tree until 11am, does
not experience the same weather as the official forecast for your zip code.
Take one photo of the spot where your plant already is, and Microclime
traces the real horizon from it, combines that with actual solar-position
math to compute real sun-hours by the hour, and tells you — for whatever
you're growing there — whether it's getting enough sun, how much and when
to water it, its sunburn risk today, and whether frost could hurt it
tonight. Log what you actually observe there and the model calibrates
itself to your exact spot over time. Comparing more than one spot, or
testing a tree edit before you commit to it, are both there too, just
tucked behind optional details instead of front and center.

## Build phases

- **Phase 1 — core sun-hours engine.** Solar-position math + a user-traced
  horizon photo, combined into an hourly sun-exposure chart for any date.
- **Phase 2 — frost/heat risk.** Live hourly forecast data layered on top of
  the sun-hours engine to flag radiative-cooling frost risk and heat stress.
- **Phase 3 — self-calibration.** The model adjusts to a user's own logged
  observations over time instead of staying a static prediction.
- **Phase 4 — what-if simulation.** Add or remove a horizon obstruction and
  instantly see the recomputed sun-hours — plan a planting before you dig.
- **Phase 5 — multi-zone mapping.** Save multiple named spots; each is
  automatically clustered into Full sun / Partial sun / Mostly shade with a
  real planting suggestion.
- **Phase 6 — community layer (concept demo).** Shows what a shared
  neighborhood microclimate map would look like, combining your real
  computed numbers with seeded demo neighbors — a real multi-user backend
  was out of scope for a solo build on this timeline.

## Stack

- **Front end:** plain HTML, CSS, vanilla JavaScript. No framework, no build
  step.
- **Back end:** Vercel serverless functions where needed (weather data proxy,
  AI-assisted interpretation).
- **Storage:** browser `localStorage`. No accounts, no database.

---

_Built during NextStep Hacks 2026 (Aug 21 – Sep 13) by Christian Saterfield._
