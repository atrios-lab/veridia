import "server-only";
import { can } from "@/core/auth/roles.ts";
import { buildDataRightsReply } from "@/core/dpo/reply-document.ts";
import { parseDetails } from "@/core/request/kinds.ts";
import { toIsoDate } from "@/core/scheduling/calendar.ts";
import { OFFICE_TIME_ZONE } from "@/core/time/office-time.ts";
import { findByProtocol } from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, today } from "@/lib/tenant.ts";

/**
 * The answer as a document: the reply sent, or, while the requerimento is
 * open, the draft as last saved (so what is printed is what was reviewed).
 */
export async function replyDocumentFor(protocolo: string) {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "channels.manage", session.user.permissions)
  ) {
    return { status: 403 as const };
  }
  const tenant = await getTenant();
  const request = await findByProtocol(
    tenant.slug,
    decodeURIComponent(protocolo),
  );
  if (!request || request.kind !== "data-rights")
    return { status: 404 as const };
  const details = parseDetails("data-rights", request.details);
  const text =
    request.status === "new"
      ? (details.draftReply ?? "")
      : (request.officeReply ?? "");
  if (!text.trim()) return { status: 409 as const };
  return {
    status: 200 as const,
    tenant,
    protocol: request.protocolNumber,
    document: buildDataRightsReply(tenant, {
      protocol: request.protocolNumber,
      applicantName: request.applicantName,
      right: details.right,
      requestedOn: toIsoDate(request.createdAt, OFFICE_TIME_ZONE),
      text,
      issuedOn: today(),
    }),
  };
}

export const NO_TEXT =
  "Salve o rascunho da resposta antes de gerar o documento.";
