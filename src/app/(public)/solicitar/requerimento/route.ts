import { getActForTenant } from "@/core/acts/catalog.ts";
import { verifyAccessKey } from "@/core/request/access-key.ts";
import { buildRequerimento } from "@/core/request/requerimento.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { renderDocument } from "@/lib/pdf.ts";
import { findByProtocol } from "@/lib/service-request.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/**
 * POST, not GET: the form carries the access key, and a key in the query
 * string ends up in the address bar, in the browser history and in every log
 * between here and the citizen.
 *
 * The PDF holds the applicant's name, contact and what they asked the office
 * for, so the key is what stands between it and anyone with the protocol.
 */
export async function POST(request: Request): Promise<Response> {
  const tenant = await getTenant();
  const form = await request.formData();
  const protocolNumber = String(form.get("protocolNumber") ?? "");
  const accessKey = String(form.get("accessKey") ?? "");

  const stored = await findByProtocol(tenant.slug, protocolNumber);
  // One answer for "no such protocol" and for "wrong key". Telling them apart
  // would let someone confirm a protocol exists by guessing numbers.
  if (
    !stored?.accessKeyHash ||
    !verifyAccessKey(accessKey, stored.accessKeyHash)
  ) {
    return new Response("Não encontrado", { status: 404 });
  }

  // Only a service request has a requerimento to sign; an appointment or a
  // manifestation carries the same protocol shape and none of these fields.
  if (!stored.actId || !stored.applicantName || !stored.contact) {
    return new Response("Não encontrado", { status: 404 });
  }
  const act = getActForTenant(tenant, stored.actId);
  if (!act) return new Response("Não encontrado", { status: 404 });

  const bytes = await renderDocument(
    buildRequerimento(tenant, act, {
      protocolNumber: stored.protocolNumber,
      accessKey,
      applicantName: stored.applicantName,
      contact: stored.contact,
      cpf: stored.cpf,
      description: stored.description,
      purpose: stored.purpose,
      parameterValue: stored.parameterValue,
      createdAt: stored.createdAt,
    }),
    // The QR on the letterhead points at the protocol lookup of the same host
    // the citizen is on, which is the tenant's own domain.
    brandFor(tenant, `${new URL(request.url).origin}/protocolo`),
  );

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="requerimento-${stored.protocolNumber}.pdf"`,
      // Personal data: no shared cache may keep a copy.
      "Cache-Control": "private, no-store",
    },
  });
}
