import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

// Per-IP click throttle. Generous to allow campaigns to drive traffic spikes.
export const clickLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(120, "1 m"),
  prefix: "rl:click",
  analytics: true,
});

// Per-IP conversion webhook throttle (HMAC-validated, this is defense-in-depth).
export const conversionLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  prefix: "rl:conv",
  analytics: true,
});

export type LimitResult = Awaited<ReturnType<Ratelimit["limit"]>>;
