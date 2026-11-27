import { can } from "@/core/auth/roles.ts";
import { bookOf, rowOf } from "@/core/books/catalog.ts";
import { officialName } from "@/core/tenant/identification.ts";
import { db } from "@/db/index.ts";
import { entryInputOf, listBookEntriesWith } from "@/lib/attribution-books.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { renderDocument, renderingFor } from "@/lib/pdf.ts";
import { csvOf, xlsxOf } from "@/lib/ri-sheet.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/**
 * The book out (`?formato=`): xlsx (planilha), csv, json, pdf (to sign or
 * print) or modelo (the empty spreadsheet to fill and import).
 */
export function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; book: string }> },
) {
  return renderingFor(request, async () => {
    const session = await getSession();
    if (
      !session ||
      !can(
        session.user.role ?? "",
        "attributions.view",
        session.user.permissions,
      )
    ) {
      return new Response("Não autorizado", { status: 403 });
    }
    const { slug, book: key } = await params;
    const book = bookOf(slug, key);
    if (!book) return new Response("Não encontrado", { status: 404 });
    const format = new URL(request.url).searchParams.get("formato") ?? "xlsx";
    const header = book.columns.map((c) => c.label);
    const file = (
      bytes: Uint8Array,
      type: string,
      ext: string,
      inline = false,
    ) =>
      new Response(new Uint8Array(bytes), {
        headers: {
          "Content-Type": type,
          "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${book.name}.${ext}"`,
          "Cache-Control": "private, no-store",
        },
      });
    const XLSX =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    if (format === "modelo") {
      return file(await xlsxOf([header], "Modelo"), XLSX, "xlsx");
    }
    const tenant = await getTenant();
    const entries = (await listBookEntriesWith(db, tenant.slug, book)).map(
      entryInputOf,
    );
    const rows = entries.map((e) => rowOf(book, e));
    if (format === "csv") {
      return file(csvOf([header, ...rows]), "text/csv; charset=utf-8", "csv");
    }
    if (format === "json") {
      const list = rows.map((r) =>
        Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])),
      );
      return file(
        new TextEncoder().encode(
          JSON.stringify({ livro: book.name, lancamentos: list }, null, 2),
        ),
        "application/json; charset=utf-8",
        "json",
      );
    }
    if (format === "pdf") {
      const pdf = await renderDocument(
        {
          eyebrow: guideTitle(slug),
          title: book.name,
          subtitle: `${rows.length} lançamentos · ${book.source}`,
          office: [officialName(tenant), tenant.subtitle],
          sections: [
            {
              heading: "Lançamentos",
              table: {
                columns: book.columns.map((c) => ({
                  label: c.label,
                  weight: c.kind === "long" ? 2 : c.key === "numero" ? 0.6 : 1,
                })),
                rows,
                empty: "Nenhum lançamento.",
              },
            },
          ],
          signature: [],
          footer: `${officialName(tenant)} · ${book.name}`,
        },
        await brandFor(tenant),
      );
      return file(new Uint8Array(pdf), "application/pdf", "pdf", true);
    }
    return file(await xlsxOf([header, ...rows], book.name), XLSX, "xlsx");
  });
}

function guideTitle(slug: string): string {
  return (
    {
      notas: "Tabelionato de Notas",
      "titulos-e-documentos": "Registro de Títulos e Documentos",
      "pessoas-juridicas": "Registro Civil das Pessoas Jurídicas",
      protesto: "Tabelionato de Protesto",
    }[slug] ?? "Livros"
  );
}
