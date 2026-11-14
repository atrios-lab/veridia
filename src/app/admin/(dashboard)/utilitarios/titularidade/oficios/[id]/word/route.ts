import { buildOficio } from "@/core/titularidade/documents.ts";
import { db } from "@/db/index.ts";
import { renderDocumentDocx } from "@/lib/guide-files.ts";
import { getIssSettings } from "@/lib/iss-declarations.ts";
import { getTenant } from "@/lib/tenant.ts";
import { getFilingWith } from "@/lib/title-transfers.ts";
import { download, mayDownload } from "../../../_files.ts";

export const runtime = "nodejs";

/** The month's ofício as a Word file, to edit or attach. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!(await mayDownload())) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const filing = await getFilingWith(db, tenant.slug, (await params).id);
  if (!filing) return new Response("Não encontrado", { status: 404 });
  const docx = await renderDocumentDocx(
    tenant,
    buildOficio(tenant, {
      number: filing.number,
      competence: filing.competence,
      transfers: filing.transfers,
      settings: await getIssSettings(tenant),
      issuedOn: filing.issuedOn,
    }),
  );
  return download(
    docx,
    `oficio-titularidade-${filing.number.replace("/", "-")}.docx`,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
}
