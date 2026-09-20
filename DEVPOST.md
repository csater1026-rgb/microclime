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

**Images:** welcome screen, photo of the spot, the hours verdict, plant picker with watering/sunburn/frost advice, spot comparison (today + week + year)

⚠️ If the 5 images already uploaded on Devpost were generated earlier in the build, they're almost certainly from the old UI (before the welcome screen, before the horizon line was removed, before week/year comparison). Replace them with fresh screenshots of the current site before submitting.

**Continuing an old project?** No. First commit is 2026-08-23, inside the hackathon window. The whole repo was built during the hackathon.

---

## About the project (paste as the story)

## Inspiration

This one's personal. My mom got into gardening this year and her plants kept getting sunburned. She'd water them in the morning and figure that was enough, but she had no way of knowing how many hours of direct sun a specific spot actually got, or if frost was coming that night. Every weather app just gives you the forecast for your whole zip code. It has no idea that one corner of the yard bakes for 8 hours while another spot stays shaded till 11am. So I built Microclime to actually answer that. How much sun and heat does this exact spot get, so she'd know how much to water and when, and get a heads up before frost killed something.

## What it does

You take one photo of your yard, standing right where your plant already is, and Microclime traces the real skyline from it automatically, wherever trees, fences, or your roof block the sky, no line to drag by hand. Then it uses real solar position astronomy, actual trigonometry, not an API call, combined with that traced horizon to calculate hour by hour when that spot is in sun or shade for any day of the year, and lays it out as a plain hour-by-hour breakdown. It pulls in live weather too and adjusts frost and heat risk for how much sun that spot got, then tells you a real watering schedule, sunburn risk, and frost risk for whatever you're growing.

Thinking about moving that plant? Take a photo of the other spot you're considering and get a real head-to-head verdict, today, a week out with the real forecast, and a year out on pure solar trend, so the "better" spot isn't just better for today. No accounts. Photos stay on your device.

## How I built it

Plain HTML, CSS, and vanilla JavaScript on the front end. No framework, no build step. The solar math is real astronomy I wrote from scratch. The horizon detection reads the actual pixels of your photo, column by column, to find where the sky ends. A Vercel serverless function handles live weather and the one AI feature (close-up plant ID), keeping API keys server side. Everything else lives in the browser with localStorage, no database.

## Challenges I ran into

The horizon detection was the hardest part. My first version picked whichever single line best split a photo into a bright half and a dark half. That worked on test images but broke on a real backyard photo, it kept locking onto the grass instead of the real treeline. I rebuilt it to scan top down for the first real brightness edge, then fixed a second issue where sunset sky color fooled it into seeing a wall that wasn't there.

A tester also said plant ID "never works." The app was sending the wide skyline photo to Gemini and asking it to name a plant, there's almost no plant to see in a skyline shot. I split that into its own close-up path and made the main advice a tap-to-pick list driven by the real sun-hours number.

Later, testers found a subtler bug: a clearly sunny spot showing almost no sun. One photo only covers about 60 degrees of sky, but the sun sweeps a much wider arc over a day, and any hour outside that slice was getting thrown out instead of counted. The fix was to assume that sky is open until the photo proves otherwise, the same honest default the app already used for a spot with no photo at all.

## What I learned

Real solar position astronomy from scratch. How much harder real photos are than clean test cases, since lighting and color casts mess with simple brightness detection. And that a hackathon app is clearer when it does one job all the way through.

## What's next

A real shared neighborhood layer, and more nights of calibration so the frost number gets personal.

---

## YouTube

- Title: Microclime: how much sun does this spot get?
- Description: NextStep Hacks 2026 (Earth Forward). Live: https://microclime.vercel.app  Repo: https://github.com/csater1026-rgb/microclime
- Visibility: Unlisted

If you re-cut the video, keep it under 5 minutes: welcome screen, photo of the spot, hours verdict, tap a plant (watering schedule + sunburn + frost), then the spot comparison (today, week, year). Skip the extra panels.
