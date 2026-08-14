import "server-only";
import { buildQuestionAnsweredEmailText } from "@/core/request/question.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import {
  renderEmailCardHtml,
  renderEmailCardText,
  tenantEmailIdentity,
} from "./render.ts";
import { sendEmail } from "./send.ts";

export interface SendQuestionAnsweredEmailParams {
  to: string;
  protocolNumber: string;
  tenant: Tenant;
  /** The protocol consult, never the record itself: the citizen still
   * types the access key there, same as every other visit. */
  actionUrl: string;
}

/**
 * The one active notification a citizen gets today: that their question was
 * answered. Best-effort by design — the caller records the reply first and
 * only then tries to send this, so a failure here never costs the reply
 * itself. See openspec/changes/perguntas-do-pedido/design.md, decision 6.
 */
export async function sendQuestionAnsweredEmail(
  params: SendQuestionAnsweredEmailParams,
): Promise<void> {
  const text = buildQuestionAnsweredEmailText({
    protocolNumber: params.protocolNumber,
  });
  await sendEmail({
    to: params.to,
    fromName: params.tenant.name,
    subject: text.subject,
    html: renderEmailCardHtml(
      text,
      tenantEmailIdentity(params.tenant),
      params.actionUrl,
    ),
    text: renderEmailCardText(text, params.actionUrl),
  });
}
