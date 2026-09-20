# Paste this into Devpost — NextStep Hacks 2026

Submit at: https://nextstep2026.devpost.com/
Deadline: Sep 20, 2026 @ 3:00pm MDT (5:00pm EDT on Devpost).

Do these in order:

1. ✅ Done — the current app (welcome screen, photo-first, fall theme, automatic invisible horizon detection, week/year spot comparison) is live on https://microclime.vercel.app.
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

**Images:** welcome screen, photo with the sun-path dots, the hours verdict, plant picker with watering/sunburn/frost advice, spot comparison (today + week + year)

⚠️ If the 5 images already uploaded on Devpost were generated earlier in the build, they're almost certainly from the old UI (before the welcome screen, before the horizon line was removed, before week/year comparison). Replace them with fresh screenshots of the current site before submitting.

**Continuing an old project?** No. First commit is 2026-08-23, inside the hackathon window. The whole repo was built during the hackathon.

---

## About the project (paste as the story)

## Inspiration

This one's personal. My mom got into gardening this year and her plants kept getting sunburned. She'd water them in the morning and figure that was enough, but she had no way of knowing how many hours of direct sun a specific spot actually got, or when the worst heat would hit, or if frost was coming that night. Every weather app just gives you the forecast for your whole zip code. It has no idea that one corner of the yard bakes for 8 hours while another spot stays shaded till 11am. So I built Microclime to actually answer that. How much sun and heat does this exact spot get, so she'd know how much to water and when, and get a heads up before frost killed something.

## What it does

You take one photo of your yard, standing right where your plant already is, and Microclime traces the real skyline from it automatically, wherever trees, fences, or your roof block the sky. No line to drag or trace by hand, it just works. Then it uses real solar position astronomy, actual trigonometry, not an API call, combined with that traced horizon to calculate hour by hour when that spot is in sun or shade for any day of the year, and draws it right on your photo as sun-path dots.

It pulls in live weather too and adjusts frost and heat risk specifically for how much sun that spot got. A shadier spot holds less heat overnight and frosts easier. A full sun spot can scorch plants in the afternoon. Tap what you're growing (tomato, lawn, hostas, and so on) and it tells you whether this spot's real sun hours are enough for that plant, a real watering schedule (specific times and how much water at each one), its sunburn risk today, and whether frost could hurt it tonight.

Thinking about moving that plant? Take a photo of the other spot you're considering and get a real head-to-head verdict, today, a week out with the real forecast (good for something temporary like a planter box), and a year out on pure solar-astronomy trend (good for a permanent bed), so the "better" spot isn't just better for today. It also learns from what you log overnight, comparing what it predicted against what actually happened, and calibrates itself to your yard's real microclimate over time.

No accounts. Photos stay on your device.

## How I built it

Plain HTML, CSS, and vanilla JavaScript on the front end. No framework, no build step, so it loads fast anywhere. The solar math is real astronomy I wrote from scratch, not a third party API. The horizon detection reads the actual pixels of your uploaded photo and figures out where the sky ends and an obstruction begins, column by column. A Vercel serverless function proxies live weather and handles the one AI feature (identifying a close-up plant photo), keeping API keys server side. Everything else, the sun math, the frost/heat model, the watering schedule, the spot comparison, lives in the browser with localStorage. No accounts, no database.

I built it in phases. First the core sun-hours engine, then frost and heat risk, then self-calibration from logged observations, then the tap-to-pick plant advice with a real watering schedule, then multi-spot comparison with week and year projections, then a concept demo of a shared neighborhood microclimate map.

## Challenges I ran into

The horizon detection was the hardest part. My first version picked whichever single line best split a photo into a bright half and a dark half. That worked on simple test images but broke on a real backyard photo. My mom's actual yard has a patio roof, then sky, then distant mountains and an open field, then a fence, then grass. The algorithm kept locking onto the biggest darkest region, the grass, instead of the real treeline or fence. I rebuilt it to scan top down for the first real brightness edge instead of splitting the whole image in half. Then I hit a second issue: sunset photos have sky that shifts from blue up top to orange near the horizon, and that color shift was fooling the detector into thinking it found an edge when it was still just looking at open sky. Fixing both took a lot of testing against the real photo instead of guessing.

A tester also said plant ID "never works." That was on me: the app was sending the wide skyline photo to Gemini and asking it to name a plant. There is almost no plant to see in a skyline shot. I split that off into its own close-up photo path and made the main advice a tap-to-pick list driven by the real sun-hours number, so it always works even if AI is down.

The bigger challenge after that was focus. I had built too many panels (a tree what-if simulator, an 8-step intro, extra detail panels) burying the one useful thing. I cut the app back to welcome screen, photo, verdict, plant tap, and moved the multi-spot comparison into the one remaining "more tools" slot.

Later, real testers found a subtler bug: a couple of them said a clearly sunny spot was showing up as getting almost no sun at all. The problem was how the app handled the part of the sky that never actually makes it into the photo. One picture can only cover roughly a 60 degree slice of sky, but the sun sweeps across a much wider arc than that over a whole day. Any hour where the sun's real position fell outside that slice was being thrown out instead of counted, so if you photographed roughly away from the sun's path, or your heading was even a little off, most of the day silently dropped out of the total and it looked like the spot barely got any sun. The fix was to treat sky outside the photo the same honest way the app already treats a spot with no photo at all: assume it's open until the picture actually proves otherwise, instead of assuming it doesn't exist.

## What I learned

I learned real solar position astronomy from scratch, how to compute elevation and azimuth for the sun at any time and location. I learned how much harder real photos are than clean test cases, since lighting and color casts mess with simple brightness detection. I also learned how to build something that calibrates itself from user feedback instead of staying a static one-time prediction.

## What's next

Building out the real multi-user neighborhood map, so spots from different households actually combine into one shared, more accurate picture instead of the concept demo it is now, and more nights of calibration so the frost number gets even more personal.

---

## YouTube

- Title: Microclime: how much sun does this spot get?
- Description: NextStep Hacks 2026 (Earth Forward). Live: https://microclime.vercel.app  Repo: https://github.com/csater1026-rgb/microclime
- Visibility: Unlisted

If you re-cut the video, keep it under 3 minutes: welcome screen, photo, sun-path dots on the picture (no line), hours verdict, tap a plant (watering schedule + sunburn + frost), then the spot comparison (today, week, year). Skip the extra panels.
