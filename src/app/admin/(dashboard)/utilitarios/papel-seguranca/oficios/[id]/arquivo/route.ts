import { can } from "@/core/auth/roles.ts";
import { reportCsv, reportFileName } from "@/core/security-paper/documents.ts";
import { db } from "@/db/index.ts";
import {
  findReportWith,
  renderReportPdf,
  snapshotOf,
} from "@/lib/security-paper.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/**
 * The ofício (with its annex) or the classificador's report as issued, to
 * print or sign; with `?formato=planilha`, the same figures as a sheet.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(
      session.user.role ?? "",
      "security-paper.manage",
      session.user.permissions,
    )
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const row = await findReportWith(db, tenant.slug, (await params).id);
  if (!row) return new Response("Não encontrado", { status: 404 });
  const snapshot = snapshotOf(row);
  if (new URL(request.url).searchParams.get("formato") === "planilha") {
    return new Response(reportCsv(snapshot), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${reportFileName(snapshot, "csv")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  const pdf = await renderReportPdf(tenant, row);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${reportFileName(snapshot, "pdf")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
