import { BounceWebhookSchema, toBounceRecord } from "@/core/email/bounce.ts";
import { webhookSecretMatches } from "@/core/email/webhook-auth.ts";
import { db } from "@/db/index.ts";
import { emailBounces } from "@/db/schema.ts";

/**
 * Receives Postmark's notice that a message came back, and records the
 * address it came back from.
 *
 * No `getSession` and no `getTenant`: the caller is a mail provider, with no
 * cookie and reaching whatever host the webhook was configured with. The
 * office, when the provider passes it along, comes from the body.
 *
 * Configure it in Postmark under the outbound stream's Webhooks tab, on the
 * Bounce event, with `?secret=` carrying POSTMARK_WEBHOOK_SECRET. Without
 * that step the table stays empty and the system behaves exactly as before.
 */

function presentedSecret(request: Request): string | null {
  return (
    new URL(request.url).searchParams.get("secret") ??
    request.headers.get("x-webhook-secret")
  );
}

export async function POST(request: Request): Promise<Response> {
  const authorized = webhookSecretMatches(
    presentedSecret(request),
    process.env.POSTMARK_WEBHOOK_SECRET,
  );
  if (!authorized) {
    // The same answer for a missing secret, a wrong one, and an endpoint
    // with none configured. Which half failed is not the caller's business.
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const parsed = BounceWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const record = toBounceRecord(parsed.data, new Date());

  await db
    .insert(emailBounces)
    .values(record)
    // One row per address: a second notice is the same mailbox saying the
    // same thing again, and the latest reason is the useful one.
    .onConflictDoUpdate({
      target: emailBounces.email,
      set: {
        kind: record.kind,
        detail: record.detail,
        permanent: record.permanent,
        tenantSlug: record.tenantSlug,
        occurredAt: record.occurredAt,
      },
    });

  // 200 even for a kind that does not block: anything else and Postmark
  // redelivers a notice already dealt with.
  return Response.json({ ok: true });
}
