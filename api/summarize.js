// Serverless "plain-English summary" endpoint.
//
// Takes this spot's REAL already-computed numbers (sun-hours, frost/heat
// risk hours, plant burn-risk severity, suggested watering window) and asks
// the model to explain what it all means in a few plain sentences — no
// jargon, nothing invented. Same OpenAI-compatible proxy pattern as the
// other endpoints: defaults to Gemini, demo-mode fallback with no key.

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const DEFAULT_MODEL = "gemini-3.6-flash";

const SYSTEM_PROMPT = `You explain a yard-monitoring app's results for
someone who isn't technical. You will be given REAL, already-computed
numbers for one exact spot — never invent, round away, or contradict them.
If a clock-time range is given for frost or heat hours (e.g. "1AM-5AM"),
say when it happens, not just how many hours — "colder overnight,
especially 1AM to 5AM" beats "5 hours of frost risk."

Write 3-4 short sentences of actual content: what's really going on at
this spot today, referencing the real numbers you were given, and the one
or two things worth doing about it (watering timing, frost/heat concern,
etc.).

Critical: respond with ONLY those sentences. Do not describe your own tone,
style, or approach — never write a label, preamble, or meta-description
like "Plain English, conversational, friendly" or "Here's a simple
summary:". Do not use jargon like "azimuth" or "elevation," bullet points,
or headers. Start the very first word of your reply with real content
about the spot, not a description of how you're about to write it.`;

// A deterministic, template-built summary from the real numbers — used both
// as the demo-mode reply (no key configured) and as a safety-net fallback
// if a live model call returns something unusable (see the defensive check
// below). Callers add their own trailing note for which case it is.
function templateSummary(c) {
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
  return bits.join(" ");
}

function demoSummary(c) {
  return `${templateSummary(c)} (Demo mode — connect a live AI key for a real generated summary.)`;
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
        max_tokens: 320,
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return res.status(502).json({ error: "The summary couldn't be reached right now.", detail: detail.slice(0, 500), mode: "live" });
    }

    const data = await upstream.json();
    let summary = data?.choices?.[0]?.message?.content?.trim() || "";

    // Defensive check: some models occasionally return a meta-description of
    // their own tone ("Plain English, conversational, friendly.") instead of
    // real content, especially when truncated. A real summary always
    // references at least one of the actual numbers it was given — if it
    // doesn't, or it's suspiciously short, fall back to the deterministic
    // template rather than show the user a broken non-answer.
    const looksLikeRealContent = summary.length > 40 && /\d/.test(summary);
    if (!looksLikeRealContent) {
      return res.status(200).json({ mode: "live", summary: templateSummary(context), fallback: true });
    }

    return res.status(200).json({ mode: "live", summary });
  } catch (err) {
    return res.status(502).json({ error: "The summary couldn't be reached right now.", detail: String(err).slice(0, 300), mode: "live" });
  }
}
