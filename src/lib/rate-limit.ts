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

// Attachments are uploaded one request each, straight from the browser, so a
// single filing with five files already spends five of them plus the
// submission itself. Sharing the ten-a-minute budget above would make "muitos
// envios seguidos" the normal outcome of attaching what the form allows.
const uploadLimiter = configured
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(40, "1 m"),
      prefix: "veridia:upload",
      analytics: false,
    })
  : null;

function addressOf(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconhecido"
  );
}

/**
 * Takes headers rather than a Request, because the two paths that need it are
 * a route handler and a server action, and only one of them has a Request.
 */
export async function isRateLimited(headers: Headers): Promise<boolean> {
  if (!limiter) return false;
  const { success } = await limiter.limit(addressOf(headers));
  return !success;
}

/** The upload route's own budget, generous enough for a real filing. */
export async function isUploadRateLimited(headers: Headers): Promise<boolean> {
  if (!uploadLimiter) return false;
  const { success } = await uploadLimiter.limit(addressOf(headers));
  return !success;
}
