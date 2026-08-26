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

const SYSTEM_PROMPT = `You identify plants from a photo and give specific,
practical watering and sun-exposure advice for that exact species.

You will be given the REAL, already-computed sun and heat data for the
plant's actual location — sun-hours today, how many of those hours are
hot/high-heat, and the current burn-risk severity. Never invent or
contradict these numbers. Your job is to identify the plant as specifically
as you reasonably can from the photo, then translate general species care
knowledge into concrete advice given THAT plant's real sun exposure today.

Respond with ONLY a JSON object, no markdown fences, no extra text, in
exactly this shape:
{
  "species": "common name (best guess)",
  "confidence": "high" | "medium" | "low",
  "sunNeeds": "one sentence on this species' ideal sun exposure",
  "waterNeeds": "one sentence, specific — e.g. how often and how much",
  "heatTolerance": "one sentence on how well this species handles today's actual heat/sun exposure at this spot",
  "tips": ["short actionable tip", "short actionable tip"]
}
If the photo doesn't clearly show a plant, set species to "Not clearly a plant" and confidence to "low", and give general tips instead.`;

function demoAnalysis(context) {
  return {
    species: "Demo mode — plant not identified",
    confidence: "low",
    sunNeeds: "Connect a live AI key to identify your actual plant from the photo.",
    waterNeeds: `Based on your spot's real data: water before the hot-sun window ends around midday if you're seeing ${context.hotHours || 0} hot-sun hour(s) today.`,
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
    `${context.hotHours ?? 0} of those hours are hot/high-heat direct sun, ` +
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
    const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();

    let analysis;
    try {
      analysis = JSON.parse(cleaned);
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
