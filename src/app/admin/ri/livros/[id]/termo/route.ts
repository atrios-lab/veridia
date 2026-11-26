import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { renderDocument, renderingFor } from "@/lib/pdf.ts";
import { termDocumentFor } from "@/lib/ri-books.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/**
 * The termo de abertura (`?tipo=abertura`) or de encerramento
 * (`?tipo=encerramento`) of a book (Lei nº 6.015/1973, art. 4º): to print
 * and sign by hand, with the signer's image (`?assinatura=imagem`), or for
 * the assinador (`?assinatura=digital`).
 */
async function handle(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "ri.view", session.user.permissions)
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const query = new URL(request.url).searchParams;
  const kind =
    query.get("tipo") === "encerramento" ? "encerramento" : "abertura";
  const term = await termDocumentFor(
    db,
    tenant,
    (await params).id,
    kind,
    query.get("assinatura") === "imagem",
  );
  if (!term) return new Response("Não encontrado", { status: 404 });
  const pdf = await renderDocument(term.document, await brandFor(tenant));
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${term.name}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export function GET(...args: Parameters<typeof handle>) {
  return renderingFor(args[0], () => handle(...args));
}
