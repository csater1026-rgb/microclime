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
garden or horizon showing grass, trees, shrubs, or several kinds of greenery
at once — treat both as valid. If several kinds of plants/grass/trees are
visible, identify each briefly and give combined, practical advice covering
all of them rather than forcing a single species. If nothing green is
clearly visible, say so plainly instead of guessing.

Also judge the plant's approximate SIZE from the photo — a rough visual
call, the same way an experienced grower would eyeball it (a small
seedling needs a fraction of the water a mature shrub does). Use your
judgment of leaf/canopy coverage, height relative to surroundings like
pots, fences, or other plants in frame, and typical size for that species
at that growth stage. Be honest that this is a visual estimate, not a
measurement — never claim more precision than a photo can actually give.

You will be given the REAL, already-computed sun and heat data for this
exact location — sun-hours today, how many of those hours are hot/high-heat
(and the actual clock-time range those hours fall in, if any), how many
hours carry frost risk tonight (and their clock-time range, if any), the
current burn-risk severity, and — when today has a hot stretch — the exact
clock times this spot should be watered before and after it (already
computed deterministically; never invent your own times when these are
given). Never invent or contradict any of these numbers — if a time range
is given, mention it naturally (e.g. "especially rough between 12PM and
4PM") instead of only giving a count.

You MUST always return a watering SCHEDULE: specific clock times, each
paired with a concrete amount at that time — never just a frequency like
"every other day" with no times, and never a bare amount with no times.
- If waterBeforeTime/waterAfterTime are given, use exactly those two times.
- If they are not given (no hot stretch today), use sensible typical times
  for this species instead — usually early morning and early evening.
Scale the AMOUNT at each time (not the times themselves) using the size
estimate and today's real heat/sun data — e.g. more per-visit for a larger
plant or a hotter/sunnier spot, less for a smaller plant or a shadier one.

Respond with ONLY a JSON object, no markdown fences, no extra text, in
exactly this shape:
{
  "species": "what you see — one species, or a short list like \\"lawn grass, a young maple, a rose bush\\"",
  "confidence": "high" | "medium" | "low",
  "sizeEstimate": "short visual size call, e.g. \\"small seedling\\", \\"medium shrub, roughly knee-high\\", \\"large mature tree\\" — or \\"n/a\\" if nothing identifiable is visible",
  "sunNeeds": "one sentence on the ideal sun exposure for what's in the photo",
  "waterSchedule": [
    { "time": "e.g. \\"7:00 AM\\" — use waterBeforeTime/waterAfterTime exactly when given", "amount": "concrete amount for THIS visit, e.g. \\"about 1 cup\\", \\"roughly half a gallon\\"" },
    { "time": "the second watering time", "amount": "concrete amount for this visit" }
  ],
  "heatTolerance": "one sentence on how well what's in the photo handles today's actual heat/sun exposure at this spot",
  "tips": ["short actionable tip", "short actionable tip"]
}
If the photo doesn't clearly show any plants, grass, or trees, set species
to "Nothing green clearly visible", confidence to "low", sizeEstimate to
"n/a", waterSchedule to an empty array, and give general tips instead.`;

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
  const schedule = context.waterBeforeTime
    ? [
        { time: context.waterBeforeTime, amount: "connect a live AI key for a real amount" },
        { time: context.waterAfterTime, amount: "connect a live AI key for a real amount" },
      ]
    : [];
  return {
    species: "Demo mode — plant not identified",
    confidence: "low",
    sunNeeds: "Connect a live AI key to identify your actual plant from the photo.",
    waterSchedule: schedule,
    heatTolerance: `This is a scripted placeholder — the live version reads your actual photo. Your spot's real data: ${context.hotHours || 0} hot-sun hour(s) today${hotRange} and ${context.frostHours || 0} frost-risk hour(s) tonight${frostRange}.`,
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
    `current burn-risk severity is "${context.severity ?? "unknown"}"` +
    (context.waterBeforeTime
      ? `. Water this spot before ${context.waterBeforeTime} and again after ${context.waterAfterTime} — use exactly these two times in waterSchedule.`
      : ". No hot stretch today, so no pre-computed watering times — pick sensible typical times for this species.");

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
      const isQuota = upstream.status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(detail);
      return res.status(upstream.status === 429 ? 429 : 502).json({
        error: isQuota ? "The AI plan's request quota is used up right now." : "The plant analysis couldn't be reached right now.",
        detail: detail.slice(0, 500),
        isQuota,
        mode: "live",
      });
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
          waterSchedule: [],
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
