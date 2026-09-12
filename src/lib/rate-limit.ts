import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { clientIp } from "./client-ip.ts";

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
  return clientIp(headers) || "desconhecido";
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

// The seal lookup spends somebody else's server: every consultation is two
// requests to the TJ (a session with its captcha, then the submission). The
// budget is what a person needs (a few captchas misread in a row) and
// nothing more, because being a heavy guest there is how the office loses
// the lookup for everyone.
const sealLimiter = configured
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      prefix: "veridia:seal",
      analytics: false,
    })
  : null;

/** The seal lookup's budget, covering both the captcha and the submission. */
export async function isSealRateLimited(headers: Headers): Promise<boolean> {
  if (!sealLimiter) return false;
  const { success } = await sealLimiter.limit(addressOf(headers));
  return !success;
}

// The tracking screens ask "did anything change?" every few seconds while
// open, each answer gated by the same access key as the consult, which makes
// this endpoint the same key oracle the consult is. A budget of its own, wide
// enough for a handful of tabs behind one address, keeps that polling from
// eating the sign-in budget and keeps a guesser at the consult's odds.
// ponytail: one Redis command per poll; if that bill matters, count only the
// misses (check the key first, limit the wrong ones).
const pollLimiter = configured
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(60, "1 m"),
      prefix: "veridia:poll",
      analytics: false,
    })
  : null;

/** The tracking poll's budget, apart from sign-in and consult. */
export async function isPollRateLimited(headers: Headers): Promise<boolean> {
  if (!pollLimiter) return false;
  const { success } = await pollLimiter.limit(addressOf(headers));
  return !success;
}
