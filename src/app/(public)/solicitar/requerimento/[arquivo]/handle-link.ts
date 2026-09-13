import { pdfLinkFileName, verifyPdfLink } from "@/core/request/pdf-link.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import type { Database } from "@/db/index.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { renderDocuments } from "@/lib/pdf.ts";
import { pdfLinkKey } from "@/lib/pdf-link-key.ts";
import { buildRequestDocuments } from "@/lib/request-documents.ts";
import { findByProtocolWith } from "@/lib/service-request.ts";

/**
 * The body of `route.ts`'s GET, pulled into its own file for the same reason
 * as handle-download.ts next door: no import of `getTenant`/`next/headers`,
 * so a test can call it under `node --test`. See design.md, decision 8.
 *
 * The GET the POST in `../route.ts` redirects to, and the one the browser's
 * PDF viewer repeats when the citizen clicks its download button.
 *
 * Everything is read from the token: which tenant, which protocol, which
 * document, until when. The `[arquivo]` segment is decorative, there so the
 * tab and the save dialog show `declaracao-REQ.2026.000295.pdf` instead of
 * the route's name, and a segment that does not match the token is not an
 * error, it is ignored.
 *
 * Every failure is the same 404 the POST gives a wrong key: a forged, stale
 * or borrowed token is a probe, and a probe learns nothing here. The
 * signature is checked before the database is touched, so a bad token costs
 * one HMAC and no query.
 */
export async function handleRequerimentoLinkWith(
  database: Database,
  tenant: Tenant,
  request: Request,
): Promise<Response> {
  const token = new URL(request.url).searchParams.get("t") ?? "";
  const link = verifyPdfLink(token, pdfLinkKey, Math.floor(Date.now() / 1000));
  if (!link) return new Response("Não encontrado", { status: 404 });

  // The same deploy serves every serventia. A link minted on one office's
  // domain is refused on another's, whatever the token says.
  if (link.tenantSlug !== tenant.slug) {
    return new Response("Não encontrado", { status: 404 });
  }

  const stored = await findByProtocolWith(
    database,
    tenant.slug,
    link.protocolNumber,
  );
  if (!stored) return new Response("Não encontrado", { status: 404 });

  const documents = buildRequestDocuments(tenant, stored, link.documento);
  if (!documents) return new Response("Não encontrado", { status: 404 });

  const brand = await brandFor(
    tenant,
    `${new URL(request.url).origin}/protocolo`,
  );
  const bytes = await renderDocuments(documents, brand);

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      // Inline: the citizen reads it in the tab, and saving from there is
      // exactly the refetch this route exists to answer.
      "Content-Disposition": `inline; filename="${pdfLinkFileName(link.documento, link.protocolNumber)}"`,
      // Personal data: no shared cache may keep a copy.
      "Cache-Control": "private, no-store",
    },
  });
}
