import { can } from "@/core/auth/roles.ts";
import { verifyAccessKey } from "@/core/request/access-key.ts";
import { buildAccessReceipt } from "@/core/request/requerimento.ts";
import { recordAudit } from "@/lib/audit.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { renderDocument, renderDocuments } from "@/lib/pdf.ts";
import { buildRequestDocuments } from "@/lib/request-documents.ts";
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
 * The sheet the counter prints for the citizen to sign on the spot. GET and no
 * access key: the operator is already authenticated by session cookie, and the
 * requerimento has carried no credential since it was split from the receipt.
 *
 * `?documento=declaracao` prints the declaração de hipossuficiência filled
 * with what the pedido has (Provimento CGJ/TJRN n. 7/2026, Anexo I), and
 * `?documento=declaracao-em-branco` the same document with nothing filled
 * in, for the office to hand over blank. Both 404 on a pedido without
 * gratuidade: there is no declaração to print or hand out for one.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ protocolo: string }> },
): Promise<Response> {
  const { protocolo } = await params;
  const loaded = await load(request, protocolo);
  if (loaded instanceof Response) return loaded;
  const { tenant, stored, brand, actorId } = loaded;

  const documento = new URL(request.url).searchParams.get("documento");
  const wantsDeclaracao =
    documento === "declaracao" || documento === "declaracao-em-branco";
  const documents = buildRequestDocuments(
    tenant,
    stored,
    wantsDeclaracao ? documento : "requerimento",
  );
  if (!documents) return new Response("Não encontrado", { status: 404 });

  const bytes = await renderDocuments(documents, brand);
  await recordAudit({
    tenantSlug: tenant.slug,
    actorId,
    action: wantsDeclaracao
      ? "service-request.print.declaracao"
      : "service-request.print.requerimento",
    targetType: "service-request",
    targetId: stored.id,
  });
  // Inline: the operator prints from the tab. Saving from the viewer works
  // too, because this is a GET the viewer can repeat with the session cookie.
  return pdf(
    bytes,
    `${wantsDeclaracao ? "declaracao" : "requerimento"}-${stored.protocolNumber}`,
    "inline",
  );
}

/**
 * The access receipt, available only while the key the panel just reissued is
 * still on screen and gets posted back here. The database holds a hash, so the
 * server cannot produce this document on its own: "only right after
 * reissuing" is a property of the design, not a rule the UI is asked to keep.
 *
 * A download, not an inline page: the browser's PDF viewer saves a file by
 * fetching the tab's URL again, by GET, and this document only exists in
 * the response to a POST carrying the key. Served inline, its download
 * button failed with "site unavailable"; served as an attachment, the
 * browser saves it from this very response and never asks again. The
 * operator opens the saved file to print it, and can keep or send it, which
 * the tab could not offer.
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
  return pdf(bytes, `comprovante-${stored.protocolNumber}`, "attachment");
}
