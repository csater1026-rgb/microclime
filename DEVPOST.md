# Paste this into Devpost — NextStep Hacks 2026

Submit at: https://nextstep2026.devpost.com/
Deadline: Sep 20, 2026 @ 3:00pm MDT (5:00pm EDT on Devpost).

Do these in order:

1. ✅ Done — the tightened app (photo-first, fall theme, garden wording) is live on https://microclime.vercel.app.
2. Upload the demo video to YouTube as Unlisted. Paste the watch URL into Devpost.
   ⚠️ The existing demo video was recorded against the OLD UI (before the
   photo-first redesign, fall theme, and the frost/water/sunburn plant
   advice) — it no longer matches the live site. Re-record before
   submitting, or submit as-is only if there's truly no time left.
3. Create the project with the copy below and submit.

---

## Form fields

**Project name:** Microclime

**Tagline** (under 200 characters):

Take one photo of your garden spot. See how many hours of sun it actually gets, and how much and when to water because of that.

**Built With:**

javascript, html5, css3, vercel, vercel-serverless-functions, open-meteo, google-gemini, solar-position-algorithm, localstorage, canvas-api

**Try it out**

- Website: https://microclime.vercel.app
- GitHub: https://github.com/csater1026-rgb/microclime

**Video:** YouTube unlisted link (you still upload the file)

**Images:** welcome screen, photo with the sun-path dots, the hours verdict, plant picker with watering/sunburn/frost advice, spot-vs-spot comparison

**Continuing an old project?** No. First commit is 2026-08-23, inside the hackathon window. The whole repo was built during the hackathon.

---

## About the project (paste as the story)

### Inspiration

My mom got into gardening and kept getting her plants sunburned. She had no way to know how many hours of sun a specific spot actually gets, or if frost is coming there tonight. Every weather app only knows our zip code. I wanted one answer: what do the sun and cold do at this exact spot, so she knows what to plant and when to water.

### What it does

You stand right at the spot where your plant already is and take a photo looking out. Microclime reads the skyline from the photo (trees, fence, roof) automatically and draws today's sun path as dots on that picture — no line to trace or drag, it just works. Then it tells you, in plain language, how many hours of sun that spot gets and what that means (full sun, partial sun, or mostly shade).

Tap what you are growing (tomato, lawn, hostas, and so on). It says whether this spot's real sun hours are enough for that plant, a real watering schedule (specific times and how much water at each one), its sunburn risk today, and whether frost could hurt it tonight.

Thinking about moving that plant? Take a photo of the other spot you're considering and get a real head-to-head verdict — which one gets more sun, which one is less likely to get sunburned, using the exact same math for both. You can also save more than one spot and compare them that way. Optional extras (a close-up plant photo, a what-if tree edit, a neighborhood mockup) stay folded away. They are not the product.

No accounts. Photos stay on your device.

### How I built it

Plain HTML, CSS, and vanilla JavaScript. No framework. The solar-position math, the horizon tracer, the frost/heat model, and the plant-fit check are code I wrote. Live weather comes from Open-Meteo. Gemini is only used if you choose a close-up plant photo. It never does the sun math.

I used Claude as a coding assistant. The decisions in the app are deterministic.

### Challenges I ran into

The first horizon tracer looked fine on fake test images and failed on a real garden photo. It kept locking onto the grass instead of the trees, and near sunset it treated the sky's own color shift as a wall. I rewrote it to find the first real brightness edge from the top down.

A tester also said plant ID "never works." That was on me: the app was sending the wide garden photo to Gemini and asking it to name a plant. There is almost no plant to see in a skyline shot. I stopped that, and made the main advice path a tap-to-pick list that uses the real sun-hours number. That path always works, even if AI is down.

The bigger challenge was focus. I had built too many panels (tree what-ifs, a neighborhood map, calibration, an 8-step intro) and they buried the one useful thing. I cut the default app back to photo, verdict, plant tap.

### Accomplishments that I'm proud of

A judge can open the live site, upload a garden photo, and get a real answer in under a minute. The astronomy and the photo overlay are real, not an API wrapper. The plant advice does not depend on a model guessing a species from the sky.

### What I learned

Solar-position math. How a computer-vision trick that works on a clean test image dies on a real sunset. And that a hackathon app is clearer when it does one job all the way through.

### What's next

A real shared neighborhood layer (the current one is labeled as a mockup), and more nights of calibration so the frost number gets personal.

---

## YouTube

- Title: Microclime: how much sun does this spot get?
- Description: NextStep Hacks 2026 (Earth Forward). Live: https://microclime.vercel.app  Repo: https://github.com/csater1026-rgb/microclime
- Visibility: Unlisted

If you re-cut the video, keep it under 3 minutes: welcome, photo, sun-path dots on the picture, hours verdict, tap a plant (watering schedule + sunburn + frost), then the spot-vs-spot comparison. Skip the extra panels.
