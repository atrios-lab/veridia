import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { fillPlaceholders } from "@/core/dpo/placeholders.ts";
import { parseDetails } from "@/core/request/kinds.ts";
import { formatDate, toIsoDate } from "@/core/scheduling/calendar.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { OFFICE_TIME_ZONE } from "@/core/time/office-time.ts";
import type { Database } from "@/db/index.ts";
import { serviceRequests } from "@/db/schema.ts";
import { recordAuditWith } from "../audit.ts";
import { type DpoModels, draftReplyWith } from "./assistant.ts";
import { officeContextFor } from "./office.ts";

/**
 * The reply's markers filled on the platform's side: the data subject's
 * name, protocol and date never went to the model (change
 * assistente-do-dpo); they come in only here.
 */
export function fillReply(
  draft: string,
  request: {
    applicantName: string | null;
    protocolNumber: string;
    createdAt: Date;
  },
  tenant: Pick<Tenant, "subtitle" | "dpo">,
): string {
  return fillPlaceholders(draft, {
    TITULAR: request.applicantName,
    PROTOCOLO: request.protocolNumber,
    DATA_DO_PEDIDO: formatDate(toIsoDate(request.createdAt, OFFICE_TIME_ZONE)),
    SERVENTIA: tenant.subtitle,
    ENCARREGADO: tenant.dpo.name,
  });
}

/**
 * The draft of the answer to an LGPD requerimento, made once the office
 * answered the Assistente Virtual's questions (decisions of 15/11/2026:
 * "ele já dá a resposta para o cartório", and "antes de preparar as
 * respostas, ele deve perguntar algumas coisas ao cartório"). Only the
 * right asked and the office's masked answers go to the model. Never
 * replaces a draft someone already wrote; never sends anything to the
 * titular. Quiet when the Assistente Virtual is off or over the month's
 * limit: the button stays for later.
 */
export async function autoDraftDataRightsWith(
  database: Database,
  models: DpoModels,
  tenant: Tenant,
  requestId: string,
  now = new Date(),
  /** The office's figures for the model (lib/dpo/office.ts by default). */
  contextFor: (tenant: Tenant, now: Date) => Promise<string> = officeContextFor,
  /** The office's answers (core/dpo/intake), masked inside the draft. */
  note = "",
): Promise<"drafted" | "skipped"> {
  const [request] = await database
    .select()
    .from(serviceRequests)
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenant.slug),
        eq(serviceRequests.id, requestId),
      ),
    );
  if (!request || request.kind !== "data-rights" || request.status !== "new") {
    return "skipped";
  }
  const details = parseDetails("data-rights", request.details);
  // A draft a person wrote is never replaced; the Assistente Virtual's own
  // is redone when the office answers the questions again.
  if (details.draftReply?.trim() && details.draftAuto !== true)
    return "skipped";
  const result = await draftReplyWith(database, models, {
    tenantSlug: tenant.slug,
    userId: null,
    userRole: "sistema",
    right: details.right,
    note: note.slice(0, 3900),
    officeContext: await contextFor(tenant, now),
    now,
  });
  if (result.status !== "ok") return "skipped";
  const draftReply = fillReply(result.draft, request, tenant);
  await database.transaction(async (tx) => {
    await tx
      .update(serviceRequests)
      .set({
        details: sql`${serviceRequests.details} || ${JSON.stringify({ draftReply, draftAuto: true })}::jsonb`,
        updatedAt: now,
      })
      .where(eq(serviceRequests.id, request.id));
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug: tenant.slug,
      actorId: null,
      action: "data-rights.auto-draft",
      targetType: "data-rights",
      targetId: request.protocolNumber,
    });
  });
  return "drafted";
}

/** The office's answers to the Assistente Virtual's questions, kept on the requerimento. */
export async function saveDataRightsIntakeWith(
  database: Database,
  tenantSlug: string,
  requestId: string,
  intake: {
    answers: Record<string, { choice: string; note: string }>;
    notes: string;
    answeredAt: string;
  },
  actorId: string,
): Promise<void> {
  await database.transaction(async (tx) => {
    const [row] = await tx
      .update(serviceRequests)
      .set({
        details: sql`${serviceRequests.details} || ${JSON.stringify({ intake })}::jsonb`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(serviceRequests.tenantSlug, tenantSlug),
          eq(serviceRequests.id, requestId),
          eq(serviceRequests.kind, "data-rights"),
        ),
      )
      .returning({ protocolNumber: serviceRequests.protocolNumber });
    if (!row) return;
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: "data-rights.intake",
      targetType: "data-rights",
      targetId: row.protocolNumber,
    });
  });
}
