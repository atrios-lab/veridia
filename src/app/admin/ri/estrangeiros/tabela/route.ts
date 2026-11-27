import { FOREIGN_COLUMNS, foreignRow } from "@/core/ri/foreign.ts";
import { db } from "@/db/index.ts";
import { entryOf, listForeignWith } from "@/lib/ri-foreign.ts";
import { csvOf, xlsxOf } from "@/lib/ri-sheet.ts";
import { getTenant } from "@/lib/tenant.ts";
import { canReadForeign } from "../_access.ts";

export const runtime = "nodejs";

/** The book as a table: `?formato=xlsx` or `?formato=csv`. */
export async function GET(request: Request): Promise<Response> {
  if (!(await canReadForeign())) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const rows = (await listForeignWith(db, tenant.slug)).map((r) => [
    ...foreignRow(entryOf(r)).map((cell) => cell.replace(/\n/g, " · ")),
    r.registeredOn.split("-").reverse().join("/"),
  ]);
  const table = [[...FOREIGN_COLUMNS, "Data do registro"], ...rows];
  const name = "Livro de aquisicao por estrangeiro";
  if (new URL(request.url).searchParams.get("formato") === "csv") {
    return new Response(new Uint8Array(csvOf(table)), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  return new Response(new Uint8Array(await xlsxOf(table, "Estrangeiros")), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
