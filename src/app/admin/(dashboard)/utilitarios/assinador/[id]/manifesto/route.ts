import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { getSession } from "@/lib/session.ts";
import {
  downloadName,
  pdfResponse,
  renderManifestPdf,
  requestOrigin,
} from "@/lib/signature/documents.ts";
import { findSignedDocumentWith } from "@/lib/signing.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "desk.access", session.user.permissions)
  ) {
    return new Response("Não encontrado", { status: 404 });
  }
  const tenant = await getTenant();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return new Response("Não encontrado", { status: 404 });
  const view = await findSignedDocumentWith(db, tenant.slug, { id });
  if (!view) return new Response("Não encontrado", { status: 404 });
  return pdfResponse(
    await renderManifestPdf(tenant, view, await requestOrigin()),
    downloadName(view.title, "manifesto"),
  );
}
