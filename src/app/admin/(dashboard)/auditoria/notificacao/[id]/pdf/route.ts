import { db } from "@/db/index.ts";
import {
  notificationNumber,
  renderNotificationPdf,
} from "@/lib/audit-documents.ts";
import { findNotificationWith, listAuditWith } from "@/lib/audit-trail.ts";
import { pdfResponse } from "@/lib/signature/documents.ts";
import { findSignedDocumentWith } from "@/lib/signing.ts";
import { readStoredFile } from "@/lib/uploads.ts";
import { auditAccess } from "../../../access.ts";

export const runtime = "nodejs";

/** The notification to print: the signed version when there is one. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const access = await auditAccess();
  if (!access) return new Response("Não encontrado", { status: 404 });
  const { id } = await params;
  const view = await findNotificationWith(db, access.tenant.slug, id);
  if (
    !view ||
    !(access.manager || view.targetUserId === access.session.user.id)
  ) {
    return new Response("Não encontrado", { status: 404 });
  }
  const name = `notificacao-${notificationNumber(view).replace("/", "-")}.pdf`;
  if (view.signedDocumentId) {
    const signed = await findSignedDocumentWith(db, access.tenant.slug, {
      id: view.signedDocumentId,
    });
    if (signed?.filePath) {
      return pdfResponse(await readStoredFile(signed.filePath), name, true);
    }
  }
  const entries = view.auditIds.length
    ? await listAuditWith(db, {
        tenantSlugs: [access.tenant.slug],
        ids: view.auditIds,
      })
    : [];
  return pdfResponse(
    await renderNotificationPdf(access.tenant, view, entries),
    name,
    true,
  );
}
