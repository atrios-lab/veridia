import { dataRightsDeadline } from "@/core/request/channels.ts";
import { parseDetails } from "@/core/request/kinds.ts";
import { buildDataRightsReceipt } from "@/core/request/requerimento.ts";
import { formatDate, toIsoDate } from "@/core/scheduling/calendar.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { renderDocument } from "@/lib/pdf.ts";
import { findByProtocolWithKey } from "@/lib/service-request.ts";
import { getTenant, OFFICE_TIME_ZONE } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/**
 * POST, not GET: the receipt carries the holder's name, e-mail and what they
 * asked the office about their own data, and the key that opens it would
 * otherwise sit in the address bar and in every log on the way.
 */
export async function POST(request: Request): Promise<Response> {
  const tenant = await getTenant();
  const form = await request.formData();
  const protocolNumber = String(form.get("protocolNumber") ?? "");
  const accessKey = String(form.get("accessKey") ?? "");

  // One answer for "no such protocol" and for "wrong key".
  const stored = await findByProtocolWithKey(
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
    brandFor(tenant, `${new URL(request.url).origin}/protocolo`),
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
