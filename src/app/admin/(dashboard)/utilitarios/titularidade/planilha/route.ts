import { can } from "@/core/auth/roles.ts";
import { transfersCsv } from "@/core/titularidade/documents.ts";
import { db } from "@/db/index.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { listTransfersWith } from "@/lib/title-transfers.ts";

export const runtime = "nodejs";

/** The month's acts as a spreadsheet (CSV that opens in Excel). */
export async function GET(request: Request): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(
      session.user.role ?? "",
      "titularidade.manage",
      session.user.permissions,
    )
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const mes = new URL(request.url).searchParams.get("mes") ?? "";
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return new Response("Escolha o mês.", { status: 400 });
  }
  const tenant = await getTenant();
  const rows = await listTransfersWith(db, tenant.slug, mes);
  return new Response(transfersCsv(rows.map((r) => r.transfer)), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="titularidade-${mes}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
