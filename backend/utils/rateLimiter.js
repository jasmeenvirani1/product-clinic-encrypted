// Generic in-memory fixed-window per-key limiter. Not distributed — resets
// per process. Good enough for low-traffic public endpoints; revisit with a
// shared store (Redis) only if this app moves to multi-instance deployment.
function createRateLimiter({ windowMs, max }) {
  const hits = new Map(); // key -> { count, windowStart }

  // Passive eviction: on every check, opportunistically drop expired entries
  // so the Map cannot grow unbounded under distinct-IP traffic/spoofing.
  function evictExpired(now) {
    for (const [key, entry] of hits) {
      if (now - entry.windowStart > windowMs) hits.delete(key);
    }
  }

  return function isAllowed(key) {
    const now = Date.now();
    if (hits.size > 5000) evictExpired(now); // bound eviction cost; only sweep when map is large
    const entry = hits.get(key);
    if (!entry || now - entry.windowStart > windowMs) {
      hits.set(key, { count: 1, windowStart: now });
      return true;
    }
    if (entry.count >= max) return false;
    entry.count += 1;
    return true;
  };
}

module.exports = { createRateLimiter };
