import { isQuinzena } from "@/core/censec/censec.ts";
import { buildCensecReport } from "@/core/censec/report.ts";
import { db } from "@/db/index.ts";
import { listCensecActsWith, listClosingsWith } from "@/lib/censec.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { renderDocument } from "@/lib/pdf.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { mayDownloadCensec } from "../_access.ts";

export const runtime = "nodejs";

/** The quinzena's report: how many acts there were and how many went. */
export async function GET(request: Request): Promise<Response> {
  if (!(await mayDownloadCensec())) {
    return new Response("Não autorizado", { status: 403 });
  }
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (!isQuinzena(q))
    return new Response("Escolha a quinzena.", { status: 400 });
  const tenant = await getTenant();
  const [acts, closings] = await Promise.all([
    listCensecActsWith(db, tenant.slug, q),
    listClosingsWith(db, tenant.slug, q),
  ]);
  const pdf = await renderDocument(
    buildCensecReport(
      tenant,
      q,
      acts.map((s) => s.act),
      closings,
      today(),
    ),
    await brandFor(tenant),
  );
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="censec-relatorio-${q}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
