import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { SIGNED_FORM_NAMES } from "@/core/request/attachment.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import type { Database } from "@/db/index.ts";
import { recordAuditWith } from "@/lib/audit.ts";
import { getAttachmentWith } from "@/lib/service-request.ts";

type Attachment = NonNullable<Awaited<ReturnType<typeof getAttachmentWith>>>;

/** Types a registrar reads on screen; anything else is handed over to save. */
const READABLE = /^(application\/pdf|image\/)/;

/**
 * Which audit action opening this attachment leaves, or null when it leaves
 * none: a signed copy opened here is the paper leaving the office's hands in
 * place of a freshly generated one, so it leaves the same trail the print
 * route does (`service-request.print.*`). Other attachments (a citizen's
 * comprovante, an office delivery) are read, not issued, and stay unlogged.
 * Pure, so the decision itself never needs a database to prove.
 */
export function signedDocumentPrintAction(
  attachment: Pick<Attachment, "kind" | "displayName">,
): string | null {
  if (attachment.kind !== "signed-form") return null;
  return attachment.displayName === SIGNED_FORM_NAMES.declaracao
    ? "service-request.print.declaracao-assinada"
    : "service-request.print.requerimento-assinado";
}

/**
 * The body of `route.ts`'s GET, once session and permission are checked
 * (that stays in route.ts; Better Auth is not tested in process). See
 * design.md, decision 8.
 */
export async function handleDocumentWith(
  database: Database,
  tenant: Tenant,
  actorId: string,
  requestId: string,
  attachmentId: string,
): Promise<Response> {
  const attachment = await getAttachmentWith(
    database,
    tenant.slug,
    requestId,
    attachmentId,
  );
  if (!attachment) return new Response("Não encontrado", { status: 404 });

  const auditAction = signedDocumentPrintAction(attachment);
  if (auditAction) {
    await recordAuditWith(database, {
      tenantSlug: tenant.slug,
      actorId,
      action: auditAction,
      targetType: "service-request",
      targetId: attachment.requestId,
    });
  }

  const bytes = attachment.path.startsWith("http")
    ? Buffer.from(await (await fetch(attachment.path)).arrayBuffer())
    : await readFile(attachment.path);

  // Inline for what the browser can render: checking four attachments should
  // not leave four copies in Downloads, and reading the file is how the office
  // decides whether the requirement was met.
  const disposition = READABLE.test(attachment.mimeType)
    ? "inline"
    : "attachment";

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `${disposition}; filename="${attachment.displayName}${extname(attachment.storedName)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
