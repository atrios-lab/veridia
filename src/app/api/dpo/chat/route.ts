import { can } from "@/core/auth/roles.ts";
import { DPO_COPY } from "@/core/dpo/copy.ts";
import { officePlaceholders } from "@/core/dpo/placeholders.ts";
import { toIsoDate } from "@/core/scheduling/calendar.ts";
import { OFFICE_TIME_ZONE } from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import { askDpoWith, type DpoEvent } from "@/lib/dpo/assistant.ts";
import { dpoBlocked, dpoModels } from "@/lib/dpo/models.ts";
import { officeContextFor } from "@/lib/dpo/office.ts";
import { readKnowledgeFiles } from "@/lib/knowledge-reading.ts";
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
  if (await isDpoRateLimited(session.user.id)) {
    return Response.json({ error: DPO_COPY.rateLimited }, { status: 429 });
  }

  // JSON for a question; multipart when a document goes with it (decision
  // of 15/11/2026): the file is read here, its text goes on, it is dropped.
  let message = "";
  let conversationId: string | null = null;
  let fileText = "";
  try {
    if ((request.headers.get("content-type") ?? "").includes("multipart/")) {
      const form = await request.formData();
      message = String(form.get("message") ?? "");
      const id = form.get("conversationId");
      conversationId = typeof id === "string" && id ? id : null;
      const file = form.get("documento");
      if (file instanceof File && file.size > 0) {
        const read = await readKnowledgeFiles([file]);
        fileText = read.documents.map((d) => d.markdown).join("\n\n");
        if (!fileText.trim()) {
          return Response.json(
            {
              error:
                read.notes[0] ??
                "Não foi possível ler o texto do documento anexado.",
            },
            { status: 400 },
          );
        }
      }
    } else {
      const body = (await request.json()) as {
        message?: unknown;
        conversationId?: unknown;
      };
      message = typeof body.message === "string" ? body.message : "";
      conversationId =
        typeof body.conversationId === "string" ? body.conversationId : null;
    }
  } catch {
    return Response.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const tenant = await getTenant();
  const blocked = await dpoBlocked(tenant.slug);
  if (blocked) return Response.json({ error: blocked }, { status: 503 });
  const now = new Date();
  const events = askDpoWith(db, dpoModels(), {
    tenantSlug: tenant.slug,
    userId: session.user.id,
    userRole: session.user.role ?? "",
    conversationId,
    message,
    officeContext: await officeContextFor(tenant, now),
    now,
    officeValues: officePlaceholders(tenant, toIsoDate(now, OFFICE_TIME_ZONE)),
    fileText,
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
