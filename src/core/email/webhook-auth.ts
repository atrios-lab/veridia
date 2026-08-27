import { timingSafeEqual } from "node:crypto";

/**
 * Whether a caller presented the webhook's shared secret.
 *
 * Its own function, away from the route, because it is the whole of the
 * endpoint's security and it has three behaviours worth pinning down in a
 * test: a wrong secret fails, no secret fails, and an environment with
 * nothing configured fails too.
 *
 * That last one is the one worth being explicit about. Elsewhere in this
 * repository a missing credential degrades gracefully: `sendEmail` without a
 * token logs instead of sending, `isRateLimited` without Upstash does not
 * limit. Neither of those opens a door. This one would: an unauthenticated
 * endpoint that writes to the bounce table lets anyone stop the panel from
 * writing to a person of their choosing, by posting that person's address.
 * So the missing-secret case refuses everything instead of accepting it.
 */
export function webhookSecretMatches(
  presented: string | null | undefined,
  expected: string | undefined,
): boolean {
  if (!expected || !presented) return false;

  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  // Compared in constant time, and only once the lengths match: differing
  // lengths make timingSafeEqual throw, and a length is not a secret.
  return a.length === b.length && timingSafeEqual(a, b);
}
