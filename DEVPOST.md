# Paste this into Devpost — NextStep Hacks 2026

Submit at: https://nextstep2026.devpost.com/
Deadline: Sep 20, 2026 @ 3:00pm MDT (5:00pm EDT on Devpost).

Do these in order:

1. Put the tightened app on https://microclime.vercel.app (see §4 if the live site still shows the old layout).
2. Upload the demo video to YouTube as Unlisted. Paste the watch URL into Devpost.
3. Create the project with the copy below and submit.

---

## Form fields

**Project name:** Microclime

**Tagline** (under 200 characters):

Take one photo of a garden spot. See how many hours of sun it actually gets, and what to plant or water because of that.

**Built With:**

javascript, html5, css3, vercel, vercel-serverless-functions, open-meteo, google-gemini, solar-position-algorithm, localstorage, canvas-api

**Try it out**

- Website: https://microclime.vercel.app
- GitHub: https://github.com/csater1026-rgb/microclime

**Video:** YouTube unlisted link (you still upload the file)

**Images:** intro, horizon photo with the sun line, the hours verdict, plant picker, saved spots

**Continuing an old project?** No. First commit is 2026-08-23, inside the hackathon window. The whole repo was built during the hackathon.

---

## About the project (paste as the story)

### Inspiration

My mom got into gardening and kept getting her plants sunburned. She had no way to know how many hours of sun a specific spot actually gets, or if frost is coming there tonight. Every weather app only knows our zip code. I wanted one answer: what do the sun and cold do at this exact spot, so she knows what to plant and when to water.

### What it does

You stand where you want to plant and take a photo looking out. Microclime traces the skyline from the photo (trees, fence, roof) and draws today's sun path on that picture. Then it tells you, in plain language, how many hours of sun that spot gets and what that means (full sun, partial sun, or mostly shade).

Tap what you are growing (tomato, lawn, hostas, and so on). It says whether this spot's real sun hours fit that plant, and when to water if today is hot. Frost risk is called out when it matters.

You can save more than one spot and compare them. Optional extras (a close-up plant photo, a what-if tree edit, a neighborhood mockup) stay folded away. They are not the product.

No accounts. Photos stay on your device.

### How I built it

Plain HTML, CSS, and vanilla JavaScript. No framework. The solar-position math, the horizon tracer, the frost/heat model, and the plant-fit check are code I wrote. Live weather comes from Open-Meteo. Gemini is only used if you choose a close-up plant photo. It never does the sun math.

I used Claude as a coding assistant. The decisions in the app are deterministic.

### Challenges I ran into

The first horizon tracer looked fine on fake test images and failed on a real backyard photo. It kept locking onto the grass instead of the trees, and near sunset it treated the sky's own color shift as a wall. I rewrote it to find the first real brightness edge from the top down.

A tester also said plant ID "never works." That was on me: the app was sending the wide yard photo to Gemini and asking it to name a plant. There is almost no plant to see in a skyline shot. I stopped that, and made the main advice path a tap-to-pick list that uses the real sun-hours number. That path always works, even if AI is down.

The bigger challenge was focus. I had built too many panels (tree what-ifs, a neighborhood map, calibration, an 8-step intro) and they buried the one useful thing. I cut the default app back to photo, verdict, plant tap.

### Accomplishments that I'm proud of

A judge can open the live site, upload a yard photo, and get a real answer in under a minute. The astronomy and the photo overlay are real, not an API wrapper. The plant advice does not depend on a model guessing a species from the sky.

### What I learned

Solar-position math. How a computer-vision trick that works on a clean test image dies on a real sunset. And that a hackathon app is clearer when it does one job all the way through.

### What's next

A real shared neighborhood layer (the current one is labeled as a mockup), and more nights of calibration so the frost number gets personal.

---

## YouTube

- Title: Microclime: how much sun does this spot get?
- Description: NextStep Hacks 2026 (Earth Forward). Live: https://microclime.vercel.app  Repo: https://github.com/csater1026-rgb/microclime
- Visibility: Unlisted

If you re-cut the video, keep it under 3 minutes: photo, line on the photo, hours verdict, tap a plant. Skip the extra panels.

---

## 4. Get the new UI onto the live site

The tightened UI is committed locally as `b4ede41` on `cursor/simplify-spot-ux-de75` in the Microclime clone, plus later photo-first edits. This Cursor session cannot push to `csater1026-rgb/microclime` (403).

Tell the Claude Code agent on that repo:

- Do not put back "use my yard photo" for plant ID.
- Photo first. No lat/lon as the first screen.
- Verdict card + plant chips are the product.
- Production URL is https://microclime.vercel.app
- Then `vercel --prod` or push to `main` so the live site updates.

Until that lands, judges who open the live URL will still see the older, busier layout.
