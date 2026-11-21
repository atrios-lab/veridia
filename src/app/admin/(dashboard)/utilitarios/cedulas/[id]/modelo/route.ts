import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { getAnalysisWith } from "@/lib/cedulas.ts";
import { modelDocument, modelsOf } from "@/lib/cedulas-files.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { renderDocumentDocx } from "@/lib/guide-files.ts";
import { renderDocument } from "@/lib/pdf.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/** One model of the analysis, as PDF (to print) or Word (to edit). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "cedulas.manage", session.user.permissions)
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const analysis = await getAnalysisWith(db, tenant.slug, (await params).id);
  if (!analysis) return new Response("Não encontrado", { status: 404 });
  const url = new URL(request.url);
  const model = modelsOf(tenant, analysis).find(
    (m) => m.id === url.searchParams.get("modelo"),
  );
  if (!model) return new Response("Modelo não encontrado", { status: 404 });
  const document = modelDocument(tenant, model);
  const base = `minuta-${model.id}`;
  if (url.searchParams.get("formato") === "word") {
    const docx = await renderDocumentDocx(tenant, document);
    return new Response(new Uint8Array(docx), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${base}.docx"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  const pdf = await renderDocument(document, await brandFor(tenant));
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${base}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
