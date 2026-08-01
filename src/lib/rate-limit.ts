import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Off when Upstash is not configured, which is the case in local development
// and in CI. It has to be on in production, so the deploy checklist covers
// the two variables rather than the code silently pretending to limit.
const configured =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

const limiter = configured
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      // Ten attempts a minute per address: generous for a person, useless for
      // credential stuffing.
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      prefix: "veridia:auth",
      analytics: false,
    })
  : null;

/**
 * Takes headers rather than a Request, because the two paths that need it are
 * a route handler and a server action, and only one of them has a Request.
 */
export async function isRateLimited(headers: Headers): Promise<boolean> {
  if (!limiter) return false;
  const address =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconhecido";
  const { success } = await limiter.limit(address);
  return !success;
}
