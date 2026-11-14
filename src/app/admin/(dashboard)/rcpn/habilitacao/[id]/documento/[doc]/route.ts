import { can } from "@/core/auth/roles.ts";
import {
  buildHabilitacaoDocument,
  documentBlocker,
  HABILITACAO_DOCUMENTS,
  type HabilitacaoDocument,
} from "@/core/rcpn/habilitacao-docs.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { renderDocument, renderingFor } from "@/lib/pdf.ts";
import { habilitacoes } from "@/lib/rcpn-habilitacao.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, today } from "@/lib/tenant.ts";

export const runtime = "nodejs";

const isDocument = (doc: string): doc is HabilitacaoDocument =>
  (HABILITACAO_DOCUMENTS as readonly string[]).includes(doc);

/** A document of the habilitação, to print or to sign digitally. */
async function handle(
  _request: Request,
  { params }: { params: Promise<{ id: string; doc: string }> },
): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "rcpn.habilitacao", session.user.permissions)
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const { id, doc } = await params;
  if (!isDocument(doc)) return new Response("Não encontrado", { status: 404 });
  const tenant = await getTenant();
  const found = await habilitacoes.get(tenant.slug, id);
  if (!found || found.canceledAt) {
    return new Response("Não encontrado", { status: 404 });
  }
  const blocker = documentBlocker(doc, found.values);
  if (blocker) {
    return new Response(blocker, {
      status: 409,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const pdf = await renderDocument(
    buildHabilitacaoDocument(doc, tenant, {
      number: found.number,
      values: found.values,
      today: today(),
    }),
    await brandFor(tenant),
  );
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="habilitacao-${found.number.replace("/", "-")}-${doc}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/**
 * "Assinar digitalmente" asks for the version without the line to sign by
 * hand (`?assinatura=digital`); printing gets the line.
 */
export function GET(...args: Parameters<typeof handle>) {
  return renderingFor(args[0], () => handle(...args));
}
