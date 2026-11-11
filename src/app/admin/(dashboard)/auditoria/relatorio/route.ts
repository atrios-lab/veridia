import { db } from "@/db/index.ts";
import { renderAuditReportPdf } from "@/lib/audit-documents.ts";
import { listAuditWith } from "@/lib/audit-trail.ts";
import { pdfResponse } from "@/lib/signature/documents.ts";
import { auditAccess, trailScope } from "../access.ts";

export const runtime = "nodejs";

/** The entries ticked on the screen, as a PDF to print or save. */
export async function POST(request: Request): Promise<Response> {
  const access = await auditAccess();
  if (!access?.manager) return new Response("Não encontrado", { status: 404 });
  const form = await request.formData();
  const ids = form.getAll("ids").map(String).slice(0, 300);
  if (!ids.length)
    return new Response("Marque ao menos um registro.", { status: 400 });
  const entries = await listAuditWith(db, {
    tenantSlugs: trailScope(access, String(form.get("serventia") ?? "")),
    ids,
  });
  return pdfResponse(
    await renderAuditReportPdf(
      access.tenant,
      entries,
      "Registros selecionados",
    ),
    "relatorio-de-auditoria.pdf",
    true,
  );
}
