import { can } from "@/core/auth/roles.ts";
import { bookCsv } from "@/core/daily-book/book.ts";
import { db } from "@/db/index.ts";
import {
  findBookReportWith,
  renderBookPdf,
  snapshotOf,
} from "@/lib/daily-book.ts";
import { renderingFor } from "@/lib/pdf.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/** The book's page as generated, to print or sign; or as a spreadsheet. */
async function handle(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "daily-book.manage", session.user.permissions)
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const row = await findBookReportWith(db, tenant.slug, (await params).id);
  if (!row) return new Response("Não encontrada", { status: 404 });
  const s = snapshotOf(row);
  const name = `livro-diario-${s.kind}-${s.kind === "dia" ? s.start : s.kind === "mes" ? s.start.slice(0, 7) : s.start.slice(0, 4)}`;
  if (new URL(request.url).searchParams.get("formato") === "planilha") {
    return new Response(bookCsv(s), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  const pdf = await renderBookPdf(tenant, row);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${name}.pdf"`,
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
