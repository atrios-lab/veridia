import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { actVariantName, getActForTenant } from "@/core/acts/catalog.ts";
import { readActVariant } from "@/core/request/kinds.ts";
import { protocolAccessLink } from "@/core/request/protocol.ts";
import { buildAccessReceipt } from "@/core/request/requerimento.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import type { Database } from "@/db/index.ts";
import { serviceRequestAttachments } from "@/db/schema.ts";
import type { DocumentBrand } from "./document-brand.ts";
import { renderDocument } from "./pdf.ts";
import type { findByProtocol } from "./service-request.ts";

type StoredRequest = NonNullable<Awaited<ReturnType<typeof findByProtocol>>>;

/** The files the citizen brought with the request, by the name shown. */
async function protocolledDocumentsWith(
  database: Database,
  tenantSlug: string,
  requestId: string,
): Promise<string[]> {
  const rows = await database
    .select({ displayName: serviceRequestAttachments.displayName })
    .from(serviceRequestAttachments)
    .where(
      and(
        eq(serviceRequestAttachments.tenantSlug, tenantSlug),
        eq(serviceRequestAttachments.requestId, requestId),
        eq(serviceRequestAttachments.kind, "citizen"),
        isNull(serviceRequestAttachments.requirementId),
        isNull(serviceRequestAttachments.requirementMessageId),
      ),
    )
    .orderBy(asc(serviceRequestAttachments.createdAt));
  return rows.map((row) => row.displayName);
}

/** The act asked for, as the requerimento names it. */
function serviceOf(tenant: Tenant, stored: StoredRequest): string | undefined {
  const act = stored.actId ? getActForTenant(tenant, stored.actId) : undefined;
  if (!act) return undefined;
  return actVariantName(act, readActVariant(stored.details)) ?? act.name;
}

/**
 * The receipt of protocol and access (decision of 22/11/2026): who
 * protocolled what, when and with which documents, the protocol and the
 * key, and a QR that opens the request with both already filled. The key
 * comes from whoever just verified it; it is never read from the database.
 */
export async function renderAccessReceiptWith(
  database: Database,
  tenant: Tenant,
  stored: StoredRequest,
  accessKey: string,
  brand: DocumentBrand,
): Promise<Buffer> {
  const documents = await protocolledDocumentsWith(
    database,
    tenant.slug,
    stored.id,
  ).catch(() => []);
  const withQr = Boolean(brand.lookupUrl);
  return renderDocument(
    buildAccessReceipt(tenant, {
      protocolNumber: stored.protocolNumber,
      accessKey,
      createdAt: stored.createdAt,
      applicantName: stored.applicantName ?? undefined,
      service: serviceOf(tenant, stored),
      documents,
      withQr,
    }),
    brand.lookupUrl
      ? {
          ...brand,
          lookupUrl: protocolAccessLink(
            new URL(brand.lookupUrl).origin,
            stored.protocolNumber,
            accessKey,
          ),
          lookupCaption: "Leia para ver o pedido e o andamento",
        }
      : brand,
  );
}
