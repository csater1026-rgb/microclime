// Same-day, no-new-infra mitigation for the AI-backed endpoints being open
// to anyone who finds the URL. This is deliberately simple: an in-memory
// per-instance counter, not a distributed limiter. It does NOT coordinate
// across concurrent or cold-started serverless instances, so it won't stop
// a determined, distributed attacker — but it does stop the realistic risk
// here, a script or bot hammering one endpoint from one place, which is
// what actually burns through a connected AI plan's quota/budget. A real
// fix needs a shared store (Vercel KV / Upstash Redis) and is tracked as a
// follow-up, not a replacement for this.

const buckets = new Map(); // key -> { count, resetAt }

// Keeps the map from growing unbounded under sustained varied traffic on a
// long-lived warm instance — cheap to check, only does work once buckets
// actually start piling up.
function pruneExpired(now) {
  if (buckets.size < 500) return;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

export function rateLimit(key, { limit = 10, windowMs = 60_000 } = {}) {
  const now = Date.now();
  pruneExpired(now);

  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;

  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  return { allowed: bucket.count <= limit, retryAfterSeconds };
}

export function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}
