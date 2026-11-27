import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { loadAcervoWith } from "@/lib/ri.ts";
import {
  type BookTable,
  personalIndicatorTable,
  protocolTable,
  realIndicatorTable,
  registryTable,
} from "@/lib/ri-book-tables.ts";
import { bookWith, protocolDaysWith } from "@/lib/ri-books.ts";
import { officeToday } from "@/lib/ri-protocols.ts";
import { csvOf, xlsxOf } from "@/lib/ri-sheet.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/**
 * The book as a table, to export (decision of 27/11/2026): `?formato=xlsx`
 * (planilha) or `?formato=csv`. The same columns as the PDF of the book.
 */
export async function GET(
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
  const book = await bookWith(db, tenant.slug, (await params).id);
  if (!book) return new Response("Não encontrado", { status: 404 });
  let table: BookTable;
  if (book.book === 1) {
    const days = await protocolDaysWith(
      db,
      tenant.slug,
      book.openedOn,
      book.closedOn ?? officeToday(),
    );
    table = protocolTable([...days.values()].flat());
  } else {
    const acervo = await loadAcervoWith(db, tenant.slug);
    table =
      book.book === 4
        ? realIndicatorTable(acervo)
        : book.book === 5
          ? personalIndicatorTable(acervo)
          : registryTable(acervo, book.book === 3 ? 3 : 2);
  }
  const rows = [table.columns, ...table.rows];
  const name = `Livro ${book.volume}`;
  if (new URL(request.url).searchParams.get("formato") === "csv") {
    return new Response(new Uint8Array(csvOf(rows)), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  return new Response(new Uint8Array(await xlsxOf(rows, name)), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
