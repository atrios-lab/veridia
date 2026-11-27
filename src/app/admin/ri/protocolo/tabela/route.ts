import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { protocolTable } from "@/lib/ri-book-tables.ts";
import { protocolDaysWith } from "@/lib/ri-books.ts";
import { officeToday } from "@/lib/ri-protocols.ts";
import { csvOf, xlsxOf } from "@/lib/ri-sheet.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/**
 * Every prenotação of the Protocolo (Livro 1) as a table, with or without
 * a book opened in the system: `?formato=xlsx|csv`, `?de=&ate=` (AAAA-MM-DD).
 */
export async function GET(request: Request): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "ri.view", session.user.permissions)
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const query = new URL(request.url).searchParams;
  const iso = (v: string | null) =>
    v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  const days = await protocolDaysWith(
    db,
    tenant.slug,
    iso(query.get("de")) ?? "1900-01-01",
    iso(query.get("ate")) ?? officeToday(),
  );
  const table = protocolTable([...days.values()].flat());
  const rows = [table.columns, ...table.rows];
  const name = "Protocolo - Livro 1";
  if (query.get("formato") === "csv") {
    return new Response(new Uint8Array(csvOf(rows)), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  return new Response(new Uint8Array(await xlsxOf(rows, "Protocolo")), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
