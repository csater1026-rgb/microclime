// Serverless "what does this plant actually need" endpoint.
//
// Deliberately narrow: given a plant (by name or photo), return ONLY its
// general sun-need range (species knowledge) — no local sun-hours, no yard
// data, nothing about the user's spots. The actual "where should I plant
// this" recommendation is computed client-side, deterministically, by
// comparing this range against each saved spot's REAL computed sun-hours.
// Keeps the AI's job honest: identify + general knowledge, not the decision.

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const DEFAULT_MODEL = "gemini-3.6-flash";

const SYSTEM_PROMPT = `You are asked about one plant, either by name or from
a photo. Identify it as specifically as you reasonably can, then give its
general, well-known sun requirement as a daily direct-sun-hours range —
this is textbook species knowledge, not anything about a specific yard.

Respond with ONLY a JSON object, no markdown fences, no extra text:
{
  "species": "common name (best guess)",
  "confidence": "high" | "medium" | "low",
  "idealSunHoursMin": <number, 0-12>,
  "idealSunHoursMax": <number, 0-12>,
  "notes": "one short sentence of general placement advice for this species"
}
If you cannot identify a real plant from what's given, set species to
"Couldn't identify a specific plant", confidence to "low", and use a
reasonable general-purpose default range like 4 to 6.`;

function demoPlacement() {
  return {
    species: "Demo mode — not identified",
    confidence: "low",
    idealSunHoursMin: 6,
    idealSunHoursMax: 8,
    notes: "Connect a live AI key to identify your actual plant and its real sun needs.",
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const plantName = typeof body?.plantName === "string" ? body.plantName.trim() : "";
  const imageDataUrl = typeof body?.imageDataUrl === "string" ? body.imageDataUrl : "";

  if (!plantName && !imageDataUrl.startsWith("data:image/")) {
    return res.status(400).json({ error: "Give a plant name or a photo." });
  }

  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ mode: "demo", plant: demoPlacement() });
  }

  const baseUrl = process.env.AI_BASE_URL || DEFAULT_BASE_URL;
  const model = process.env.AI_MODEL || DEFAULT_MODEL;

  const userContent = imageDataUrl
    ? [
        { type: "text", text: "What plant is this, and what's its ideal daily direct-sun-hours range?" },
        { type: "image_url", image_url: { url: imageDataUrl } },
      ]
    : `What is the ideal daily direct-sun-hours range for: ${plantName}?`;

  try {
    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        temperature: 0.3,
        max_tokens: 250,
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return res.status(502).json({ error: "Couldn't look that up right now.", detail: detail.slice(0, 500), mode: "live" });
    }

    const data = await upstream.json();
    const raw = data?.choices?.[0]?.message?.content?.trim() || "";
    const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();

    let plant;
    try {
      plant = JSON.parse(cleaned);
    } catch {
      return res.status(200).json({
        mode: "live",
        plant: { species: "Couldn't parse a clean result", confidence: "low", idealSunHoursMin: 4, idealSunHoursMax: 6, notes: raw.slice(0, 200) },
      });
    }

    return res.status(200).json({ mode: "live", plant });
  } catch (err) {
    return res.status(502).json({ error: "Couldn't look that up right now.", detail: String(err).slice(0, 300), mode: "live" });
  }
}
