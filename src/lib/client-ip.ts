/**
 * The first hop of the forwarding chain, or undefined when there is none
 * (local development, a health check that carries no proxy header). Split
 * out of `rate-limit.ts` so the same reading feeds both the limiter's bucket
 * key and the gratuidade's aceite record (`src/app/(public)/solicitar/
 * actions.ts`): one function that decides what "the citizen's address"
 * means, not two copies that could drift.
 */
export function clientIp(headers: Headers): string | undefined {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
}
