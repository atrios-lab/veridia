import { can } from "@/core/auth/roles.ts";
import { DPO_COPY } from "@/core/dpo/copy.ts";
import { db } from "@/db/index.ts";
import { askDpoWith, type DpoEvent } from "@/lib/dpo/assistant.ts";
import { dpoModels, isDpoAssistantConfigured } from "@/lib/dpo/models.ts";
import { officeContextFor } from "@/lib/dpo/office.ts";
import { isDpoRateLimited } from "@/lib/rate-limit.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * One question to the DPO assistant, answered as a stream of JSON lines
 * (`DpoEvent`, one per line) on the panel's own origin, so the CSP stays
 * `connect-src 'self'`. Transport only: the flow, the masking and the
 * ceiling are `askDpoWith`'s.
 *
 * Nothing here logs the request body: the text may carry personal data
 * until askDpoWith masks it.
 */
export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return Response.json({ error: "Não encontrado." }, { status: 404 });
  }
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "dpo.assist", session.user.permissions)
  ) {
    return Response.json({ error: "Não encontrado." }, { status: 404 });
  }
  if (!isDpoAssistantConfigured()) {
    return Response.json({ error: DPO_COPY.unavailable }, { status: 503 });
  }
  if (await isDpoRateLimited(session.user.id)) {
    return Response.json({ error: DPO_COPY.rateLimited }, { status: 429 });
  }

  let body: { message?: unknown; conversationId?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message : "";
  const conversationId =
    typeof body.conversationId === "string" ? body.conversationId : null;

  const tenant = await getTenant();
  const now = new Date();
  const events = askDpoWith(db, dpoModels(tenant.slug), {
    tenantSlug: tenant.slug,
    userId: session.user.id,
    userRole: session.user.role ?? "",
    conversationId,
    message,
    officeContext: await officeContextFor(tenant, now),
    now,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await events.next();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
      } catch (error) {
        // Never the body: only that the flow broke, and where.
        console.error("dpo.chat", error instanceof Error ? error.name : "erro");
        const failed: DpoEvent = { type: "error", message: DPO_COPY.failed };
        controller.enqueue(encoder.encode(`${JSON.stringify(failed)}\n`));
        controller.close();
      }
    },
    async cancel() {
      await events.return(undefined);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
