import "server-only";
import type { EmailText } from "@/core/email/text.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import {
  renderEmailCardHtml,
  renderEmailCardText,
  tenantEmailIdentity,
} from "./render.ts";
import { sendEmail } from "./send.ts";

/** Where the Átrios is told an office has sent its answers. */
const ATRIOS_INBOX =
  process.env.COMPLIANCE_NOTIFY_EMAIL ?? "contato@atrioss.com";

export interface ComplianceSubmittedParams {
  tenant: Tenant;
  submitterName: string;
  version: number;
  /** The module's screen in this office's panel, absolute. */
  panelUrl: string;
}

/**
 * Two messages for one submission: the office gets a receipt, the Átrios
 * gets the call to work. Each is sent on its own and a failure in one never
 * cancels the other; the submission is already stamped by the time this
 * runs, and the panel shows it regardless of what the mail server did.
 */
export async function sendComplianceSubmittedEmails(
  params: ComplianceSubmittedParams,
): Promise<void> {
  const { tenant } = params;
  const identity = tenantEmailIdentity(tenant);

  const receipt: EmailText = {
    subject: "Recebemos as informações da adequação ao Provimento",
    paragraphs: [
      `${params.submitterName} enviou as respostas do módulo Adequação ao Provimento do painel de ${tenant.name}.`,
      "A Átrios revisa as respostas, confirma o que precisar com você pelo WhatsApp e entrega os documentos pessoalmente.",
      "As respostas continuam abertas no painel. Se corrigir alguma depois do envio, a Átrios vê a alteração por lá.",
    ],
    buttonLabel: "Abrir o painel",
    footnote:
      "Este e-mail confirma o envio; ele não substitui a assinatura dos documentos nem a declaração no Justiça Aberta.",
  };

  const notice: EmailText = {
    subject: `${tenant.name}: informações da adequação enviadas (versão ${params.version})`,
    paragraphs: [
      `${params.submitterName} enviou as respostas do módulo Adequação ao Provimento no painel de ${tenant.name}.`,
      "As respostas, as pendências detectadas e o botão de exportar o JSON estão no módulo, com o perfil Átrios.",
    ],
    buttonLabel: "Ver as respostas",
    footnote: `Serventia ${tenant.slug}, versão ${params.version} das respostas.`,
  };

  const results = await Promise.allSettled([
    sendEmail({
      to: tenant.contacts.email,
      fromName: tenant.name,
      fromAddress: tenant.emailFrom,
      subject: receipt.subject,
      html: renderEmailCardHtml(receipt, identity, params.panelUrl),
      text: renderEmailCardText(receipt, params.panelUrl),
    }),
    sendEmail({
      to: ATRIOS_INBOX,
      fromName: tenant.name,
      fromAddress: tenant.emailFrom,
      subject: notice.subject,
      html: renderEmailCardHtml(notice, identity, params.panelUrl),
      text: renderEmailCardText(notice, params.panelUrl),
    }),
  ]);
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("compliance.submitted-email", result.reason);
    }
  }
}
