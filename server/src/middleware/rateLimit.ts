import rateLimit from 'express-rate-limit';

// WHY two tiers instead of one: reading the dashboard is cheap and frequent
// (an agent refreshing a list is normal), but writes create documents — a
// public create form is the classic spam target, so it gets a much lower cap.

// WHY per-IP in-memory counters: zero extra infrastructure for a single
// instance. Trade-off (documented in README): behind a load balancer with N
// replicas each replica counts separately, so you'd swap in a shared Redis
// store — the middleware supports that without changing the routes.

const shared = {
  windowMs: 60_000, // 1-minute window: short enough that a blocked user isn't locked out long
  standardHeaders: true as const, // WHY: RateLimit-* headers let well-behaved clients back off
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again shortly' }, // same JSON shape as all other errors
  // WHY disable this validation: the Vite dev proxy can add X-Forwarded-For;
  // we intentionally key on the socket IP (correct for a single instance).
  validate: { xForwardedForHeader: false },
};

// 300 reads/min ≈ 5 per second sustained — far above human browsing, low
// enough to stop a scraping loop from monopolizing the DB.
export const readLimiter = rateLimit({ ...shared, limit: 300 });

// 30 writes/min — no human files tickets faster; bots do.
export const writeLimiter = rateLimit({ ...shared, limit: 30 });

// 10 login attempts/min — login is the brute-force target; a human retyping
// a password never needs more, a password-guessing script needs thousands.
export const loginLimiter = rateLimit({ ...shared, limit: 10 });
