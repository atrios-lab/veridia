import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { renderingFor } from "@/lib/pdf.ts";
import { BookTooLarge, bookPdfFor } from "@/lib/ri-books.ts";
import { protocolPeriodPdfFor } from "@/lib/ri-protocol-sheets.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * The whole book as the models annexed to the Lei nº 6.015/1973: the
 * termo de abertura, the columns of the model (Livros 1, 3, 4 and 5) or
 * the fichas of the Livro 2 (the signed image where there is one), and
 * the termo de encerramento. `?de=&ate=` narrows it.
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
  const id = (await params).id;
  try {
    const book = await bookPdfFor(
      db,
      tenant,
      id,
      {
        from: query.get("de") ?? undefined,
        to: query.get("ate") ?? undefined,
      },
      query.get("assinatura") === "imagem",
      {
        seal:
          query.get("selo") === "nenhum"
            ? "nenhum"
            : query.get("selo") === "imagem"
              ? "imagem"
              : "numero",
        word: query.get("formato") === "word",
        // The Livro 1 in the model of the book.
        protocolSheets: (from, to) =>
          protocolPeriodPdfFor(db, tenant, { bookId: id, from, to }),
      },
    );
    if (!book) return new Response("Não encontrado", { status: 404 });
    if (book.word) {
      return new Response(new Uint8Array(book.bytes), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${book.name}.docx"`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    return new Response(new Uint8Array(book.bytes), {
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
