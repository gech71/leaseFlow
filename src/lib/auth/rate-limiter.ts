
import 'server-only';
import { Ratelimit } from "@upstash/ratelimit";

// This is a simple in-memory cache. It's suitable for development and
// single-instance deployments. For a production, multi-instance setup,
// you would replace this with an Upstash Redis or a similar external cache.
const cache = new Map();

export const rateLimiter = new Ratelimit({
  // Allow 5 requests in a 60-second window.
  limiter: Ratelimit.slidingWindow(5, "60 s"),
  // Use the in-memory cache for tracking requests.
  ephemeralCache: cache,
  analytics: false,
});
