// @ts-check
const buckets = new Map(); // naive in-memory; replace with Redis in prod
const WINDOW_MS = 5 * 60 * 1000,
  MAX_REQ = 30;

function keyFor(req) {
  return `${req.user?._id || req.ip}:files`;
}

function rateLimit(req, res, next) {
  const k = keyFor(req);
  const now = Date.now();
  const b = buckets.get(k) || [];
  const recent = b.filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_REQ)
    return res
      .status(429)
      .json({ success: false, message: "Too many requests" });
  recent.push(now);
  buckets.set(k, recent);
  next();
}

module.exports = { rateLimit };





