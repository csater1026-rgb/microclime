// Serverless plant-ID + care-advice endpoint.
//
// Takes a photo of an actual plant plus this spot's REAL computed sun/heat
// data (from the client's own solar-position + risk model — never invented
// here) and asks a vision-capable model to identify the plant and tailor
// specific watering/sun-tolerance advice to that species. The AI's job is
// narrow: identify + personalize. The underlying sun-hours and heat-risk
// numbers it's given are always the real, already-computed ones.
//
// Same OpenAI-compatible proxy pattern as the other hackathon builds:
// defaults to Google Gemini, falls back to a scripted demo reply with no
// API key so the live link is never blank.

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const DEFAULT_MODEL = "gemini-3.6-flash";

const SYSTEM_PROMPT = `You identify plants, grass, or trees from a photo and
give specific, practical watering and sun-exposure advice.

The photo might be a close-up of one plant, or it might be a wide shot of a
yard or horizon showing grass, trees, shrubs, or several kinds of greenery
at once — treat both as valid. If several kinds of plants/grass/trees are
visible, identify each briefly and give combined, practical advice covering
all of them rather than forcing a single species. If nothing green is
clearly visible, say so plainly instead of guessing.

You will be given the REAL, already-computed sun and heat data for this
exact location — sun-hours today, how many of those hours are hot/high-heat
(and the actual clock-time range those hours fall in, if any), how many
hours carry frost risk tonight (and their clock-time range, if any), and the
current burn-risk severity. Never invent or contradict these numbers —
if a time range is given, mention it naturally (e.g. "especially rough
between 12PM and 4PM") instead of only giving a count.

Respond with ONLY a JSON object, no markdown fences, no extra text, in
exactly this shape:
{
  "species": "what you see — one species, or a short list like \\"lawn grass, a young maple, a rose bush\\"",
  "confidence": "high" | "medium" | "low",
  "sunNeeds": "one sentence on the ideal sun exposure for what's in the photo",
  "waterNeeds": "one sentence, specific — e.g. how often and how much",
  "heatTolerance": "one sentence on how well what's in the photo handles today's actual heat/sun exposure at this spot",
  "tips": ["short actionable tip", "short actionable tip"]
}
If the photo doesn't clearly show any plants, grass, or trees, set species
to "Nothing green clearly visible" and confidence to "low", and give general
tips instead.`;

// Models occasionally wrap the JSON in prose ("Sure, here's the result:"),
// use a code fence without the "json" tag, or add trailing commentary after
// it — any of which broke a strict JSON.parse on the raw reply. Strip any
// fence first, then fall back to just the substring between the first "{"
// and the last "}" (in practice always the actual object) before giving up.
function extractJson(raw) {
  const fenced = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    return JSON.parse(fenced);
  } catch {
    const start = fenced.indexOf("{");
    const end = fenced.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) throw new Error("no JSON object found");
    return JSON.parse(fenced.slice(start, end + 1));
  }
}

function demoAnalysis(context) {
  const hotRange = context.hotHoursRange ? ` (roughly ${context.hotHoursRange})` : "";
  const frostRange = context.frostHoursRange ? ` (roughly ${context.frostHoursRange})` : "";
  return {
    species: "Demo mode — plant not identified",
    confidence: "low",
    sunNeeds: "Connect a live AI key to identify your actual plant from the photo.",
    waterNeeds: `Based on your spot's real data: you're seeing ${context.hotHours || 0} hot-sun hour(s) today${hotRange} and ${context.frostHours || 0} frost-risk hour(s) tonight${frostRange}.`,
    heatTolerance: "This is a scripted placeholder — the live version reads your actual photo.",
    tips: ["Add a live API key to get species-specific identification and advice."],
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
  const imageDataUrl = typeof body?.imageDataUrl === "string" ? body.imageDataUrl : "";
  const context = body?.context && typeof body.context === "object" ? body.context : {};

  if (!imageDataUrl.startsWith("data:image/")) {
    return res.status(400).json({ error: "No valid photo provided." });
  }

  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ mode: "demo", analysis: demoAnalysis(context) });
  }

  const baseUrl = process.env.AI_BASE_URL || DEFAULT_BASE_URL;
  const model = process.env.AI_MODEL || DEFAULT_MODEL;

  const contextLine =
    `Real data for this spot today: ${context.sunHours ?? "unknown"} total sun-hours, ` +
    `${context.hotHours ?? 0} of those hours are hot/high-heat direct sun` +
    `${context.hotHoursRange ? ` (${context.hotHoursRange})` : ""}, ` +
    `${context.frostHours ?? 0} hours carry frost risk tonight` +
    `${context.frostHoursRange ? ` (${context.frostHoursRange})` : ""}, ` +
    `current burn-risk severity is "${context.severity ?? "unknown"}".`;

  try {
    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: contextLine },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        temperature: 0.4,
        max_tokens: 400,
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return res.status(502).json({ error: "The plant analysis couldn't be reached right now.", detail: detail.slice(0, 500), mode: "live" });
    }

    const data = await upstream.json();
    const raw = data?.choices?.[0]?.message?.content?.trim() || "";

    let analysis;
    try {
      analysis = extractJson(raw);
    } catch {
      return res.status(200).json({
        mode: "live",
        analysis: {
          species: "Couldn't parse a clean result",
          confidence: "low",
          sunNeeds: raw.slice(0, 300) || "The model's reply wasn't in the expected format.",
          waterNeeds: "",
          heatTolerance: "",
          tips: [],
        },
      });
    }

    return res.status(200).json({ mode: "live", analysis });
  } catch (err) {
    return res.status(502).json({ error: "The plant analysis couldn't be reached right now.", detail: String(err).slice(0, 300), mode: "live" });
  }
}
