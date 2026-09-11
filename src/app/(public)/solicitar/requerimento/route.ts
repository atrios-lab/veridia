import { verifyAccessKey } from "@/core/request/access-key.ts";
import {
  type LinkableDocument,
  PDF_LINK_TTL_SECONDS,
  pdfLinkFileName,
  signPdfLink,
} from "@/core/request/pdf-link.ts";
import { buildAccessReceipt } from "@/core/request/requerimento.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { renderDocument } from "@/lib/pdf.ts";
import { pdfLinkKey } from "@/lib/pdf-link-key.ts";
import { buildRequestDocuments } from "@/lib/request-documents.ts";
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
 *
 * Three documents are picked by the `documento` field, and they leave here
 * two different ways.
 *
 * The requerimento and the declaração de hipossuficiência (Provimento
 * CGJ/TJRN n. 7/2026, Anexo I) are not sent back in this response. They are
 * answered with a redirect to a signed GET link (see `[arquivo]/route.ts`),
 * because the browser's PDF viewer saves a file by fetching the tab's URL
 * again, by GET, and a tab reached by POST has nothing to fetch: Chrome's
 * download button answered "site unavailable" for every one of these files.
 * The link carries a token, never the key.
 *
 * The access receipt prints the key itself, so there is no link that could
 * serve it without being the key. It is answered here, as a download: the
 * browser saves it straight from this response and never opens a viewer.
 */
export async function POST(request: Request): Promise<Response> {
  const tenant = await getTenant();
  const form = await request.formData();
  const protocolNumber = String(form.get("protocolNumber") ?? "");
  const accessKey = String(form.get("accessKey") ?? "");
  // A format choice, not a credential: anything unexpected falls back to the
  // requerimento rather than failing.
  const documento = form.get("documento");

  const stored = await findByProtocol(tenant.slug, protocolNumber);
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
      `${new URL(request.url).origin}/protocolo`,
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
  const location = new URL(
    `/solicitar/requerimento/${pdfLinkFileName(linkable, stored.protocolNumber)}`,
    request.url,
  );
  location.searchParams.set("t", token);

  // 303, so the browser follows with a GET whatever method brought it here.
  return new Response(null, {
    status: 303,
    headers: {
      Location: location.toString(),
      "Cache-Control": "private, no-store",
    },
  });
}
