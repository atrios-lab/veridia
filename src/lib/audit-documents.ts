import "server-only";
import { ROLE_LABELS } from "@/app/admin/_components/role-labels.ts";
import {
  buildAuditReportDocument,
  buildNotificationDocument,
  type EntryForDocument,
} from "@/core/audit/documents.ts";
import type { Role } from "@/core/auth/roles.ts";
import { formatGuideNumber } from "@/core/guides/schema.ts";
import { holderName } from "@/core/tenant/identification.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { formatOfficeDateTime } from "@/core/time/office-time.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { sendEmail } from "@/lib/email/send.ts";
import { renderDocument } from "@/lib/pdf.ts";
import type { NotificationView } from "./audit-trail.ts";

export function notificationNumber(
  view: Pick<NotificationView, "year" | "sequence">,
): string {
  return formatGuideNumber(view.year, view.sequence);
}

/** The notification as the office prints and signs it. */
export async function renderNotificationPdf(
  tenant: Tenant,
  view: NotificationView,
  entries: EntryForDocument[],
): Promise<Buffer> {
  return renderDocument(
    buildNotificationDocument(tenant, {
      year: view.year,
      sequence: view.sequence,
      subject: view.subject,
      facts: view.facts,
      legalBasis: view.legalBasis,
      targetName: view.targetName ?? "",
      targetRoleLabel:
        ROLE_LABELS[(view.targetRole ?? "") as Role] ?? view.targetRole ?? "",
      deadlineAt: view.deadlineAt,
      issuedAt: view.createdAt,
      entries,
      holderName: holderName(tenant) ?? "Tabelião/Registrador",
      holderTitle: tenant.holderTitle ?? "Tabelião/Registrador",
    }),
    await brandFor(tenant),
  );
}

export async function renderAuditReportPdf(
  tenant: Tenant,
  entries: EntryForDocument[],
  scope: string,
): Promise<Buffer> {
  return renderDocument(
    buildAuditReportDocument(tenant, { entries, issuedAt: new Date(), scope }),
    await brandFor(tenant),
  );
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** To the notified person's own account e-mail, with the PDF. */
export async function emailNotification(
  tenant: Tenant,
  view: NotificationView,
  pdf: Buffer,
): Promise<void> {
  if (!view.targetEmail) return;
  const number = notificationNumber(view);
  const deadline = formatOfficeDateTime(view.deadlineAt);
  await sendEmail({
    to: view.targetEmail,
    fromName: tenant.name,
    fromAddress: tenant.emailFrom,
    subject: `Notificação nº ${number}: pedido de esclarecimentos`,
    text:
      `Olá, ${view.targetName ?? ""}.\n\n` +
      `O titular da serventia enviou a Notificação nº ${number}, "${view.subject}", pedindo esclarecimentos. ` +
      `Você tem até ${deadline} (24 horas) para responder, na área Auditoria do painel. O documento segue em anexo.`,
    html:
      `<p>Olá, ${escapeHtml(view.targetName ?? "")}.</p>` +
      `<p>O titular da serventia enviou a <strong>Notificação nº ${number}</strong>, "${escapeHtml(view.subject)}", pedindo esclarecimentos.</p>` +
      `<p>Você tem até <strong>${deadline}</strong> (24 horas) para responder, na área <strong>Auditoria</strong> do painel. O documento segue em anexo.</p>`,
    attachments: [
      { filename: `notificacao-${number.replace("/", "-")}.pdf`, content: pdf },
    ],
  });
}

/** The selected entries, to any address the Tabelião/Registrador types. */
export async function emailAuditReport(
  tenant: Tenant,
  to: string,
  pdf: Buffer,
  count: number,
): Promise<void> {
  await sendEmail({
    to,
    fromName: tenant.name,
    fromAddress: tenant.emailFrom,
    subject: `Relatório de auditoria (${count} registros)`,
    text: `Segue em anexo o relatório de auditoria do painel do ${tenant.name}, com ${count} registros. Uso interno.`,
    html: `<p>Segue em anexo o relatório de auditoria do painel do ${escapeHtml(tenant.name)}, com ${count} registros. Uso interno.</p>`,
    attachments: [{ filename: "relatorio-de-auditoria.pdf", content: pdf }],
  });
}

/** Tells the holders of the office that an answer arrived. */
export async function emailAnswerArrived(
  tenant: Tenant,
  view: NotificationView,
  holders: { email: string }[],
): Promise<void> {
  const number = notificationNumber(view);
  for (const holder of holders) {
    await sendEmail({
      to: holder.email,
      fromName: tenant.name,
      fromAddress: tenant.emailFrom,
      subject: `Resposta à Notificação nº ${number}`,
      text: `${view.targetName ?? "A pessoa notificada"} respondeu à Notificação nº ${number}. Veja em Auditoria, no painel.`,
      html: `<p>${escapeHtml(view.targetName ?? "A pessoa notificada")} respondeu à <strong>Notificação nº ${number}</strong>. Veja em Auditoria, no painel.</p>`,
    }).catch((error) => console.error("auditoria.email-resposta", error));
  }
}
