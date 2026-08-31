// Serverless "plain-English summary" endpoint.
//
// Takes this spot's REAL already-computed numbers (sun-hours, frost/heat
// risk hours, plant burn-risk severity, suggested watering window) and asks
// the model to explain what it all means in a few plain sentences — no
// jargon, nothing invented. Same OpenAI-compatible proxy pattern as the
// other endpoints: defaults to Gemini, demo-mode fallback with no key.

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const DEFAULT_MODEL = "gemini-3.6-flash";

const SYSTEM_PROMPT = `You explain a yard-monitoring app's results in plain
English for someone who isn't technical. You will be given REAL,
already-computed numbers for one exact spot — never invent, round away, or
contradict them. If a clock-time range is given for frost or heat hours
(e.g. "1AM-5AM"), say when it happens, not just how many hours — "colder
overnight, especially 1AM to 5AM" beats "5 hours of frost risk." Write 3-4
short sentences: what's actually going on at this spot today, and the one
or two things worth doing about it (watering timing, frost/heat concern,
etc.). No jargon like "azimuth" or "elevation." No bullet points, no
headers — just plain sentences a person would actually say to a friend. Do
not repeat every number robotically; pick what matters.`;

function demoSummary(c) {
  const bits = [];
  bits.push(`This spot gets about ${c.sunHours ?? "some"} hours of direct sun today.`);
  if (c.frostHours) {
    const when = c.frostHoursRange ? `, especially ${c.frostHoursRange}` : "";
    bits.push(`It'll likely see frost for around ${c.frostHours} hour${c.frostHours === 1 ? "" : "s"} overnight${when}, colder than the general forecast.`);
  }
  if (c.heatHours) {
    const when = c.heatHoursRange ? ` (${c.heatHoursRange})` : "";
    bits.push(`Expect ${c.heatHours} hour${c.heatHours === 1 ? "" : "s"} of real heat stress in direct sun${when}.`);
  }
  if (c.plantSeverity && c.plantSeverity !== "none") bits.push(`Sun/heat stress on plants here is rated "${c.plantSeverity}" today.`);
  if (typeof c.waterBefore === "number") bits.push(`Consider watering before the heat builds up and again once it eases off.`);
  bits.push("(Demo mode — connect a live AI key for a real generated summary.)");
  return bits.join(" ");
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
  const context = body?.context && typeof body.context === "object" ? body.context : {};

  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ mode: "demo", summary: demoSummary(context) });
  }

  const baseUrl = process.env.AI_BASE_URL || DEFAULT_BASE_URL;
  const model = process.env.AI_MODEL || DEFAULT_MODEL;

  const contextText = `Real data for this spot today:
- Sun-hours: ${context.sunHours ?? "unknown"}
- Frost-risk hours tonight: ${context.frostHours ?? 0}${context.frostHoursRange ? ` (clock time: ${context.frostHoursRange})` : ""}
- Heat-stress hours: ${context.heatHours ?? 0}${context.heatHoursRange ? ` (clock time: ${context.heatHoursRange})` : ""}
- Plant/grass burn-risk severity: ${context.plantSeverity ?? "unknown"}
- Suggested watering window: ${typeof context.waterBefore === "number" ? `before ${context.waterBefore}:00 and after ${context.waterAfter}:00` : "none needed"}`;

  try {
    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: contextText },
        ],
        temperature: 0.5,
        max_tokens: 220,
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return res.status(502).json({ error: "The summary couldn't be reached right now.", detail: detail.slice(0, 500), mode: "live" });
    }

    const data = await upstream.json();
    const summary = data?.choices?.[0]?.message?.content?.trim() || "Sorry — couldn't put that into words right now.";
    return res.status(200).json({ mode: "live", summary });
  } catch (err) {
    return res.status(502).json({ error: "The summary couldn't be reached right now.", detail: String(err).slice(0, 300), mode: "live" });
  }
}
