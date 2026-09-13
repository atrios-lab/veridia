import { verifyAccessKey } from "@/core/request/access-key.ts";
import {
  type LinkableDocument,
  PDF_LINK_TTL_SECONDS,
  pdfLinkFileName,
  signPdfLink,
} from "@/core/request/pdf-link.ts";
import { buildAccessReceipt } from "@/core/request/requerimento.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import type { Database } from "@/db/index.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { renderDocument } from "@/lib/pdf.ts";
import { pdfLinkKey } from "@/lib/pdf-link-key.ts";
import { buildRequestDocuments } from "@/lib/request-documents.ts";
import { findByProtocolWith } from "@/lib/service-request.ts";

/**
 * The body of `route.ts`'s POST, pulled into its own file with no import of
 * `getTenant` (or anything else from `next/*`): `getTenant` reads
 * `next/headers`, which only resolves inside a real Next request, and
 * importing it here would drag that into any test of this function. See
 * design.md, decision 8.
 */
export async function handleRequerimentoDownloadWith(
  database: Database,
  tenant: Tenant,
  form: FormData,
  origin: string,
): Promise<Response> {
  const protocolNumber = String(form.get("protocolNumber") ?? "");
  const accessKey = String(form.get("accessKey") ?? "");
  // A format choice, not a credential: anything unexpected falls back to the
  // requerimento rather than failing.
  const documento = form.get("documento");

  const stored = await findByProtocolWith(
    database,
    tenant.slug,
    protocolNumber,
  );
  // One answer for "no such protocol" and for "wrong key". Telling them apart
  // would let someone confirm a protocol exists by guessing numbers.
  if (
    !stored?.accessKeyHash ||
    !verifyAccessKey(accessKey, stored.accessKeyHash)
  ) {
    return new Response("Não encontrado", { status: 404 });
  }

  // Only a service request has these documents; an appointment or a
  // manifestation carries the same protocol shape and none of the fields.
  if (!stored.actId || !stored.applicantName || !stored.contact) {
    return new Response("Não encontrado", { status: 404 });
  }

  if (documento === "comprovante") {
    const brand = await brandFor(
      tenant,
      // The QR on the letterhead points at the protocol lookup of the same
      // host the citizen is on, which is the tenant's own domain.
      `${origin}/protocolo`,
    );
    const bytes = await renderDocument(
      buildAccessReceipt(tenant, {
        protocolNumber: stored.protocolNumber,
        accessKey,
        createdAt: stored.createdAt,
      }),
      brand,
    );
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="comprovante-${stored.protocolNumber}.pdf"`,
        // Personal data: no shared cache may keep a copy.
        "Cache-Control": "private, no-store",
      },
    });
  }

  const linkable: LinkableDocument =
    documento === "declaracao" ? "declaracao" : "requerimento";
  // Checked before redirecting, so a pedido without gratuidade gets its 404
  // here rather than a redirect to one.
  if (!buildRequestDocuments(tenant, stored, linkable)) {
    return new Response("Não encontrado", { status: 404 });
  }

  const token = signPdfLink(
    {
      tenantSlug: tenant.slug,
      protocolNumber: stored.protocolNumber,
      documento: linkable,
      expiresAt: Math.floor(Date.now() / 1000) + PDF_LINK_TTL_SECONDS,
    },
    pdfLinkKey,
  );
  // A relative Location, on purpose. `request.url` is the origin Next was
  // reached on, not the one in the citizen's address bar (localhost behind
  // the tenant's host in development, the deployment URL behind the custom
  // domain on Vercel), and a redirect that changes origin is a redirect the
  // page's own CSP (`form-action 'self'`) tells the browser to abort. A path
  // stays on whatever host the form was posted from, and the GET route
  // checks that host's tenant against the one in the token.
  const location = `/solicitar/requerimento/${pdfLinkFileName(linkable, stored.protocolNumber)}?t=${encodeURIComponent(token)}`;

  // 303, so the browser follows with a GET whatever method brought it here.
  return new Response(null, {
    status: 303,
    headers: {
      Location: location,
      "Cache-Control": "private, no-store",
    },
  });
}
