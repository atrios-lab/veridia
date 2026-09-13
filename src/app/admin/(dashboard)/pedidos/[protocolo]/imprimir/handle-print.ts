import { verifyAccessKey } from "@/core/request/access-key.ts";
import { buildAccessReceipt } from "@/core/request/requerimento.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import type { Database } from "@/db/index.ts";
import { recordAuditWith } from "@/lib/audit.ts";
import type { DocumentBrand } from "@/lib/document-brand.ts";
import { renderDocument, renderDocuments } from "@/lib/pdf.ts";
import { buildRequestDocuments } from "@/lib/request-documents.ts";
import type { findByProtocol } from "@/lib/service-request.ts";

type StoredRequest = NonNullable<Awaited<ReturnType<typeof findByProtocol>>>;

function pdf(
  bytes: Buffer,
  name: string,
  disposition: "inline" | "attachment",
): Response {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${name}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/**
 * The body of `route.ts`'s GET, once session and permission are already
 * checked (that part stays in `route.ts`; Better Auth is not tested in
 * process, see design.md's non-goals). This is the part with a rule worth
 * proving: printing writes to the audit log, under the right action, and a
 * pedido without gratuidade never produces a declaração.
 */
export async function printRequerimentoWith(
  database: Database,
  tenant: Tenant,
  stored: StoredRequest,
  actorId: string,
  brand: DocumentBrand,
  documento: string | null,
): Promise<Response> {
  const wantsDeclaracao =
    documento === "declaracao" || documento === "declaracao-em-branco";
  const documents = buildRequestDocuments(
    tenant,
    stored,
    wantsDeclaracao ? documento : "requerimento",
  );
  if (!documents) return new Response("Não encontrado", { status: 404 });

  const bytes = await renderDocuments(documents, brand);
  await recordAuditWith(database, {
    tenantSlug: tenant.slug,
    actorId,
    action: wantsDeclaracao
      ? "service-request.print.declaracao"
      : "service-request.print.requerimento",
    targetType: "service-request",
    targetId: stored.id,
  });
  return pdf(
    bytes,
    `${wantsDeclaracao ? "declaracao" : "requerimento"}-${stored.protocolNumber}`,
    "inline",
  );
}

/**
 * The body of `route.ts`'s POST: the access receipt, gated by the key
 * itself, not the session. A wrong key never writes to the audit log; a
 * live one always does, under `service-request.print.comprovante`.
 */
export async function printReceiptWith(
  database: Database,
  tenant: Tenant,
  stored: StoredRequest,
  actorId: string,
  brand: DocumentBrand,
  accessKey: string,
): Promise<Response> {
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
  await recordAuditWith(database, {
    tenantSlug: tenant.slug,
    actorId,
    action: "service-request.print.comprovante",
    targetType: "service-request",
    targetId: stored.id,
  });
  return pdf(bytes, `comprovante-${stored.protocolNumber}`, "attachment");
}
