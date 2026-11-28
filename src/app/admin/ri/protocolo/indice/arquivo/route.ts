import { can } from "@/core/auth/roles.ts";
import { volumeName } from "@/core/ri/books.ts";
import { db } from "@/db/index.ts";
import { renderingFor } from "@/lib/pdf.ts";
import {
  INDEX_COLUMNS,
  indexRows,
  protocolIndexPdf,
  protocolIndexWith,
  protocolIndexWord,
} from "@/lib/ri-protocol-index.ts";
import { csvOf, xlsxOf } from "@/lib/ri-sheet.ts";
import { printChoiceWith } from "@/lib/ri-signers.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * The índice of the Protocolo of one book (`?livro=`): PDF (with who signs,
 * the rubrica, the signature and the digital signature, as the book),
 * `?formato=word`, `xlsx` or `csv`.
 */
async function handle(request: Request): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "ri.view", session.user.permissions)
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const query = new URL(request.url).searchParams;
  const index = await protocolIndexWith(db, tenant, query.get("livro") ?? "");
  if (!index) return new Response("Livro não encontrado", { status: 404 });
  const name = `Indice do Protocolo - ${volumeName(index.volume)}`;
  const format = query.get("formato");
  if (format === "csv" || format === "xlsx") {
    const rows = [INDEX_COLUMNS, ...indexRows(index.entries)];
    const bytes = format === "csv" ? csvOf(rows) : await xlsxOf(rows, "Indice");
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type":
          format === "csv"
            ? "text/csv; charset=utf-8"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}.${format}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  const choice = await printChoiceWith(db, tenant, query);
  if (format === "word") {
    const docx = await protocolIndexWord(
      tenant,
      index.volume,
      index.entries,
      choice,
    );
    return new Response(new Uint8Array(docx), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${name}.docx"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  const pdf = await protocolIndexPdf(
    tenant,
    index.volume,
    index.entries,
    choice,
  );
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${name}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export function GET(request: Request) {
  return renderingFor(request, () => handle(request));
}
