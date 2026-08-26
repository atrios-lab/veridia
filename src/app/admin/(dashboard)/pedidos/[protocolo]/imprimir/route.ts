import { getActForTenant } from "@/core/acts/catalog.ts";
import { can } from "@/core/auth/roles.ts";
import { verifyAccessKey } from "@/core/request/access-key.ts";
import {
  buildAccessReceipt,
  buildRequerimento,
} from "@/core/request/requerimento.ts";
import { recordAudit } from "@/lib/audit.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { renderDocument } from "@/lib/pdf.ts";
import { findByProtocol } from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/** Session, permission and the request itself, or the Response that refuses. */
async function load(request: Request, protocolo: string) {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "requests.manage")) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const stored = await findByProtocol(
    tenant.slug,
    decodeURIComponent(protocolo),
  );
  if (!stored || stored.kind !== "service-request") {
    return new Response("Não encontrado", { status: 404 });
  }
  return {
    tenant,
    stored,
    actorId: session.user.id,
    brand: await brandFor(tenant, `${new URL(request.url).origin}/protocolo`),
  };
}

function pdf(bytes: Buffer, name: string): Response {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      // Inline: the operator prints from the tab, they are not filing a copy.
      "Content-Disposition": `inline; filename="${name}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/**
 * The sheet the counter prints for the citizen to sign on the spot. GET and no
 * access key: the operator is already authenticated by session cookie, and the
 * requerimento has carried no credential since it was split from the receipt.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ protocolo: string }> },
): Promise<Response> {
  const { protocolo } = await params;
  const loaded = await load(request, protocolo);
  if (loaded instanceof Response) return loaded;
  const { tenant, stored, brand, actorId } = loaded;

  if (!stored.actId || !stored.applicantName || !stored.contact) {
    return new Response("Não encontrado", { status: 404 });
  }
  const act = getActForTenant(tenant, stored.actId);
  if (!act) return new Response("Não encontrado", { status: 404 });

  const bytes = await renderDocument(
    buildRequerimento(tenant, act, {
      protocolNumber: stored.protocolNumber,
      applicantName: stored.applicantName,
      contact: stored.contact,
      cpf: stored.cpf,
      description: stored.description,
      purpose: stored.purpose,
      parameterValue: stored.parameterValue,
      createdAt: stored.createdAt,
    }),
    brand,
  );
  await recordAudit({
    tenantSlug: tenant.slug,
    actorId,
    action: "service-request.print.requerimento",
    targetType: "service-request",
    targetId: stored.id,
  });
  return pdf(bytes, `requerimento-${stored.protocolNumber}`);
}

/**
 * The access receipt, printable only while the key the panel just reissued is
 * still on screen and gets posted back here. The database holds a hash, so the
 * server cannot produce this document on its own: "only right after
 * reissuing" is a property of the design, not a rule the UI is asked to keep.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ protocolo: string }> },
): Promise<Response> {
  const { protocolo } = await params;
  const loaded = await load(request, protocolo);
  if (loaded instanceof Response) return loaded;
  const { tenant, stored, brand, actorId } = loaded;

  const form = await request.formData();
  const accessKey = String(form.get("chave") ?? "");
  // The key has to be the live one. A stale key from a previous reissue would
  // print a receipt that no longer opens anything.
  if (
    !stored.accessKeyHash ||
    !verifyAccessKey(accessKey, stored.accessKeyHash)
  ) {
    return new Response("Não encontrado", { status: 404 });
  }

  const bytes = await renderDocument(
    buildAccessReceipt(tenant, {
      protocolNumber: stored.protocolNumber,
      accessKey,
      createdAt: stored.createdAt,
    }),
    brand,
  );
  await recordAudit({
    tenantSlug: tenant.slug,
    actorId,
    action: "service-request.print.comprovante",
    targetType: "service-request",
    targetId: stored.id,
  });
  return pdf(bytes, `comprovante-${stored.protocolNumber}`);
}
