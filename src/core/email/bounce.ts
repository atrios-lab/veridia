import { z } from "zod";

/**
 * What the provider tells us when a message comes back, and what it means.
 * Pure: no database, no provider client, so the rule that decides whether an
 * address is dead can be read and tested on its own.
 */

/**
 * The kinds that mean the address will not take mail again. Postmark names
 * dozens; these are the ones where trying again is trying the same thing.
 *
 * Everything else is temporary by omission, and that direction is deliberate:
 * a kind we have never seen should let the message through, not silently
 * lock a citizen out of the office's only written channel. "Caixa cheia",
 * "resposta automática de férias" and "filtro recusou o conteúdo" all say
 * something about today, nothing about the address.
 */
const PERMANENT_KINDS = new Set([
  "HardBounce",
  "BadEmailAddress",
  "SpamNotification",
  "SpamComplaint",
  "ManuallyDeactivated",
  "Unsubscribe",
  "Blocked",
  "SuppressionRequest",
]);

export function isPermanentBounce(kind: string): boolean {
  return PERMANENT_KINDS.has(kind.trim());
}

/**
 * The slice of Postmark's bounce webhook this system reads. Only the declared
 * fields survive: the body arrives from outside, so it is data, and anything
 * we did not ask for has no way to reach the database.
 *
 * `Description` and `Details` are both optional in practice, and Postmark
 * sends either depending on the kind: the one that came is the one shown.
 */
export const BounceWebhookSchema = z.object({
  Email: z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.toLowerCase()),
  Type: z.string().trim().min(1),
  Description: z.string().optional(),
  Details: z.string().optional(),
  BouncedAt: z.string().optional(),
  Metadata: z.object({ tenantSlug: z.string() }).partial().optional(),
});

export interface BounceRecord {
  email: string;
  kind: string;
  detail: string;
  permanent: boolean;
  tenantSlug: string | null;
  occurredAt: Date;
}

/**
 * Turns a validated body into the row to store. `now` is passed in rather
 * than read here so the module stays pure and the test does not depend on
 * the clock: Postmark's own timestamp is preferred when it parses, because
 * it is when the mail server answered, not when we got around to reading it.
 */
export function toBounceRecord(
  body: z.infer<typeof BounceWebhookSchema>,
  now: Date,
): BounceRecord {
  const stamped = body.BouncedAt ? new Date(body.BouncedAt) : null;
  return {
    email: body.Email,
    kind: body.Type,
    detail: (body.Description || body.Details || "").trim(),
    permanent: isPermanentBounce(body.Type),
    tenantSlug: body.Metadata?.tenantSlug ?? null,
    occurredAt: stamped && !Number.isNaN(stamped.getTime()) ? stamped : now,
  };
}
