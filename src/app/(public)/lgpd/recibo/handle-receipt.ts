import { dataRightsDeadline } from "@/core/request/channels.ts";
import { parseDetails } from "@/core/request/kinds.ts";
import { buildDataRightsReceipt } from "@/core/request/requerimento.ts";
import { formatDate, toIsoDate } from "@/core/scheduling/calendar.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import type { Database } from "@/db/index.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { OFFICE_TIME_ZONE } from "@/lib/office-config.ts";
import { renderDocument } from "@/lib/pdf.ts";
import { findByProtocolWithKeyWith } from "@/lib/service-request.ts";

/**
 * The body of `route.ts`'s POST, in its own file so a test can call it
 * without pulling in `getTenant`/`next/headers`. Same reasoning as
 * solicitar/requerimento/handle-download.ts; see design.md, decision 8.
 */
export async function handleDataRightsReceiptWith(
  database: Database,
  tenant: Tenant,
  form: FormData,
  origin: string,
): Promise<Response> {
  const protocolNumber = String(form.get("protocolNumber") ?? "");
  const accessKey = String(form.get("accessKey") ?? "");

  // One answer for "no such protocol" and for "wrong key".
  const stored = await findByProtocolWithKeyWith(
    database,
    tenant.slug,
    protocolNumber,
    accessKey,
  );
  if (!stored || stored.kind !== "data-rights" || !stored.applicantName) {
    return new Response("Não encontrado", { status: 404 });
  }

  const { right } = parseDetails("data-rights", stored.details);
  const requestedOn = toIsoDate(stored.createdAt, OFFICE_TIME_ZONE);

  const bytes = await renderDocument(
    buildDataRightsReceipt(tenant, {
      protocolNumber: stored.protocolNumber,
      accessKey,
      applicantName: stored.applicantName,
      email: stored.contact ?? "",
      cpf: stored.cpf,
      right,
      description: stored.description ?? "",
      createdAt: stored.createdAt,
      deadline: formatDate(dataRightsDeadline(requestedOn)),
    }),
    await brandFor(tenant, `${origin}/protocolo`),
  );

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="recibo-lgpd-${stored.protocolNumber}.pdf"`,
      // Personal data: no shared cache may keep a copy.
      "Cache-Control": "private, no-store",
    },
  });
}
