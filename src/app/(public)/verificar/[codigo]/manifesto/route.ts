import { db } from "@/db/index.ts";
import {
  downloadName,
  pdfResponse,
  renderManifestPdf,
  requestOrigin,
} from "@/lib/signature/documents.ts";
import { findSignedDocumentWith } from "@/lib/signing.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/** The manifest, drawn now from the record: always there, always current. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ codigo: string }> },
): Promise<Response> {
  const tenant = await getTenant();
  const { codigo } = await params;
  const view = await findSignedDocumentWith(db, tenant.slug, { code: codigo });
  if (!view) return new Response("Não encontrado", { status: 404 });
  return pdfResponse(
    await renderManifestPdf(tenant, view, await requestOrigin()),
    downloadName(view.title, "manifesto"),
  );
}
