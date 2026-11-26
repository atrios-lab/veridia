import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { renderDocuments, renderingFor } from "@/lib/pdf.ts";
import { BookTooLarge, bookDocumentsFor } from "@/lib/ri-books.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * The whole book in one PDF, to print or sign at once: the termo de
 * abertura, the fichas (Livros 2 and 3), the days of the Protocolo (Livro
 * 1) or the indicador (Livros 4 and 5), and the termo de encerramento.
 * `?de=&ate=` narrows it (matrículas, or dates for the Livro 1).
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
  try {
    const book = await bookDocumentsFor(
      db,
      tenant,
      (await params).id,
      {
        from: query.get("de") ?? undefined,
        to: query.get("ate") ?? undefined,
      },
      query.get("assinatura") === "imagem",
    );
    if (!book) return new Response("Não encontrado", { status: 404 });
    const pdf = await renderDocuments(book.documents, await brandFor(tenant));
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${book.name}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof BookTooLarge) {
      return new Response(error.message, {
        status: 413,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    throw error;
  }
}

export function GET(...args: Parameters<typeof handle>) {
  return renderingFor(args[0], () => handle(...args));
}
