import { can } from "@/core/auth/roles.ts";
import { reportCsv, reportFileName } from "@/core/security-paper/documents.ts";
import { db } from "@/db/index.ts";
import { renderingFor } from "@/lib/pdf.ts";
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
async function handle(
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

/**
 * "Assinar digitalmente" asks for the version without the line to sign by
 * hand (`?assinatura=digital`); printing gets the line.
 */
export function GET(...args: Parameters<typeof handle>) {
  return renderingFor(args[0], () => handle(...args));
}
