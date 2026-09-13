import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { findByProtocol } from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { printReceiptWith, printRequerimentoWith } from "./handle-print.ts";

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
 *
 * The actual work is `printRequerimentoWith`, in its own file: this route
 * only resolves the session and the request. See handle-print.ts and
 * design.md, decision 8.
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
  return printRequerimentoWith(db, tenant, stored, actorId, brand, documento);
}

/**
 * The access receipt. The only caller left is `pedidos/novo` (lançamento no
 * balcão), which has the key in hand from the same response that just
 * created the pedido and posts it straight back here. The detail page for
 * an existing pedido has no path to this route any more: the panel cannot
 * produce a fresh key for a request that already exists (the database holds
 * only its hash), and reissuing one is the citizen's own job now, from the
 * consult page's "Perdi a chave de acesso", which never shows the key back
 * to whoever asked, so it has nothing to post here either.
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
  return printReceiptWith(db, tenant, stored, actorId, brand, accessKey);
}
