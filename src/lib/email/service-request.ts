import "server-only";
import { after } from "next/server";
import type { EmailText } from "@/core/email/text.ts";
import {
  DATA_RIGHT_OPTIONS,
  manifestationLabel,
} from "@/core/request/channels.ts";
import { isEmailContact } from "@/core/request/form.ts";
import type { DataRight, ManifestationType } from "@/core/request/kinds.ts";
import { formatCents } from "@/core/request/money.ts";
import { brandImageUrl } from "@/core/tenant/brand-image.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { findPermanentBounce } from "./bounces.ts";
import {
  renderAccessKeyEmailHtml,
  renderAccessKeyEmailText,
  renderEmailCardHtml,
  renderEmailCardText,
  renderNoticeEmailHtml,
  tenantEmailIdentity,
} from "./render.ts";
import { sendEmail } from "./send.ts";

/**
 * The office nudging a citizen about their own protocol, or the platform
 * handing the citizen their own access key.
 *
 * Two rules hold every one of these together. First, the message never
 * carries the content: not the requirement's text, not the office's reply,
 * not the delivered file, not the access key, with exactly one exception,
 * `sendAccessKey` below, whose entire job is to carry the key. An e-mail is
 * the one channel the office cannot vouch for, so what stays out of it stays
 * out on purpose. Second, sending is best effort: the notice (or the key) is
 * a courtesy on top of a consult that already works, so a mail provider
 * having a bad minute must never be why an exigência failed to register or a
 * pedido failed to file.
 */
export interface NotifyCitizenParams {
  tenant: Tenant;
  /** The contact the citizen filed with: an e-mail, or a phone we skip. */
  contact: string | null;
  protocolNumber: string;
  subject: string;
  body: string;
}

function plainText(params: NotifyCitizenParams): string {
  return [
    params.body,
    "",
    `Protocolo: ${params.protocolNumber}`,
    "",
    "Consulte com o seu protocolo e a sua chave de acesso para ver os detalhes.",
    "",
    params.tenant.name,
  ].join("\n");
}

/**
 * The two steps every citizen-facing send shares: check the address is not a
 * known bounce, then hand the actual send to `after`, swallowing its own
 * failure into a log. Returns before the message is sent: the caller has
 * nothing to await and nothing to catch beyond the bounce warning, per the
 * "best effort" half of the contract above.
 *
 * The send is handed to `after` rather than left as a floating promise. On a
 * platform function the response ends the invocation, and a fetch still in
 * flight is suspended with it: the socket then times out unnoticed, and the
 * error only surfaces minutes later, on whatever unrelated request happens
 * to wake that instance. `after` is what keeps the invocation alive until
 * the send finishes.
 */
async function deliverCitizenEmail(params: {
  tenant: Tenant;
  contact: string | null;
  logTag: string;
  build: (
    contact: string,
    host: string | undefined,
  ) => { subject: string; html: string; text: string };
}): Promise<string | null> {
  // A phone number is a valid contact for a request and not a mailbox. The
  // office reaches those the way it always did, by calling.
  const contact = params.contact;
  if (!contact || !isEmailContact(contact)) return null;
  const trimmed = contact.trim();

  // Looked up before the send is scheduled, and awaited: the send itself
  // stays deferred because a mail provider is slow, but a primary-key read
  // is not, and this is the one piece of it the caller needs while it is
  // still building its own response. Learning weeks later that the citizen
  // never heard back is the failure this whole contract is about.
  const bounced = await findPermanentBounce(trimmed);
  if (bounced) {
    return `O e-mail ${trimmed} não recebe mensagens: ${
      bounced.detail || "a última mensagem voltou"
    }. Avise por telefone.`;
  }

  const host = params.tenant.hosts[0];
  after(async () => {
    try {
      const { subject, html, text } = params.build(trimmed, host);
      await sendEmail({
        to: trimmed,
        fromName: params.tenant.name,
        fromAddress: params.tenant.emailFrom,
        subject,
        html,
        text,
      });
    } catch (error) {
      console.error(params.logTag, error);
    }
  });

  return null;
}

export async function notifyCitizen(
  params: NotifyCitizenParams,
): Promise<string | null> {
  return deliverCitizenEmail({
    tenant: params.tenant,
    contact: params.contact,
    logTag: "email.notify-citizen",
    build: (_contact, host) => ({
      subject: `${params.subject} · ${params.protocolNumber}`,
      html: renderNoticeEmailHtml({
        officeName: params.tenant.name,
        officeSubtitle: params.tenant.subtitle,
        sealUrl: brandImageUrl(params.tenant.logos.seal.light, host),
        body: params.body,
        protocolNumber: params.protocolNumber,
        consultUrl: host ? `https://${host}/protocolo` : "",
      }),
      text: plainText(params),
    }),
  });
}

export interface SendAccessKeyParams {
  tenant: Tenant;
  /** The contact the citizen filed with: an e-mail, or a phone we skip. */
  contact: string | null;
  protocolNumber: string;
  /** In the clear: this is the one function allowed to put it in a message. */
  accessKey: string;
  /** "received": the pedido that just generated this key. "recovered": the
   * citizen asked the consult page for a new one. */
  reason: "received" | "recovered";
}

const ACCESS_KEY_SUBJECTS: Record<SendAccessKeyParams["reason"], string> = {
  received: "Pedido recebido",
  recovered: "Nova chave de acesso",
};

/**
 * The only two messages that carry the citizen's access key: the receipt a
 * pedido sends when it is filed, and the reply to a recovery asked for from
 * the consult page. Everything else in this file, `notifyCitizen` included,
 * keeps the key out on purpose (see the file's own contract, above); this
 * function exists so that promise never has to bend for a seventh caller.
 * Same bounce check, same `after`, same best-effort return as
 * `notifyCitizen`, through `deliverCitizenEmail`.
 */
export async function sendAccessKey(
  params: SendAccessKeyParams,
): Promise<string | null> {
  return deliverCitizenEmail({
    tenant: params.tenant,
    contact: params.contact,
    logTag: "email.send-access-key",
    build: (_contact, host) => {
      const shared = {
        officeName: params.tenant.name,
        officeSubtitle: params.tenant.subtitle,
        sealUrl: brandImageUrl(params.tenant.logos.seal.light, host),
        protocolNumber: params.protocolNumber,
        accessKey: params.accessKey,
        consultUrl: host ? `https://${host}/protocolo` : "",
        reason: params.reason,
      } as const;
      return {
        subject: `${ACCESS_KEY_SUBJECTS[params.reason]} · ${params.protocolNumber}`,
        html: renderAccessKeyEmailHtml(shared),
        text: renderAccessKeyEmailText(shared),
      };
    },
  });
}

export interface NotifyOfficePaymentReportedParams {
  tenant: Tenant;
  protocolNumber: string;
  /** The requester's name, when the request has one. */
  applicantName: string | null;
  amountCents: number;
}

/**
 * The office's own nudge that a citizen used "Já paguei": unlike
 * `notifyCitizen`, this one carries the payer and the value, because the
 * recipient is the office's own institutional inbox (`tenant.contacts.email`),
 * never a citizen's address behind an access key. It is only the alert that a
 * comprovante is waiting: it never confirms the payment itself, which stays
 * a manual call in the panel.
 *
 * Same fire-and-forget contract as `notifyCitizen`, built entirely inside the
 * deferred callback: a mail provider (or a tenant missing a host) having a
 * bad moment must never be why "Já paguei" fails for the citizen.
 */
export function notifyOfficePaymentReported(
  params: NotifyOfficePaymentReportedParams,
): void {
  const { tenant, protocolNumber, applicantName, amountCents } = params;

  after(async () => {
    try {
      const host = tenant.hosts[0];
      const panelUrl = host
        ? `https://${host}/admin/pedidos/${protocolNumber}`
        : "";
      const text: EmailText = {
        subject: `Pagamento informado · ${protocolNumber}`,
        paragraphs: [
          `${applicantName?.trim() || "O requerente"} informou o pagamento do pedido ${protocolNumber}, no valor de ${formatCents(amountCents)}.`,
          "O comprovante já está anexado ao pedido, no painel. Confira e confirme o pagamento por lá.",
        ],
        buttonLabel: "Ver o pedido",
        footnote:
          "Este e-mail é só o aviso: a confirmação do pagamento continua manual, pelo painel.",
      };
      const identity = tenantEmailIdentity(tenant);

      await sendEmail({
        to: tenant.contacts.email,
        fromName: tenant.name,
        fromAddress: tenant.emailFrom,
        subject: text.subject,
        html: renderEmailCardHtml(text, identity, panelUrl),
        text: renderEmailCardText(text, panelUrl),
      });
    } catch (error) {
      console.error("email.payment-reported", error);
    }
  });
}

/**
 * This file also hosts the office-facing notices below for LGPD and
 * ombudsman submissions, even though those are different domains from
 * service requests. Each channel gains exactly one new send here (the
 * citizen-facing confirmation both already send is `notifyCitizen`, shared
 * from this same file), so a dedicated email module per channel would be
 * overhead for a single function. See design.md of
 * `completar-avisos-por-email` for the trade-off.
 */

export interface NotifyOfficeRequirementReplyParams {
  tenant: Tenant;
  protocolNumber: string;
  /** The requester's name, when the request has one. */
  applicantName: string | null;
}

/**
 * The office's nudge that a citizen wrote in a requirement's conversation:
 * the mirror image of the notice the citizen gets when the office replies
 * (`renderNoticeEmailHtml` via `notifyCitizen`, triggered elsewhere). Like
 * `notifyOfficePaymentReported`, the recipient is the office's own
 * institutional inbox, so the message can name the requester: it just never
 * carries the citizen's own words, the same restraint the office's own
 * replies observe toward the citizen.
 */
export function notifyOfficeRequirementReply(
  params: NotifyOfficeRequirementReplyParams,
): void {
  const { tenant, protocolNumber, applicantName } = params;

  after(async () => {
    try {
      const host = tenant.hosts[0];
      const panelUrl = host
        ? `https://${host}/admin/pedidos/${protocolNumber}`
        : "";
      const text: EmailText = {
        subject: `Resposta na exigência · ${protocolNumber}`,
        paragraphs: [
          `${applicantName?.trim() || "O requerente"} respondeu na exigência do pedido ${protocolNumber}.`,
          "Consulte a conversa no painel para ver a mensagem e responder.",
        ],
        buttonLabel: "Ver o pedido",
        footnote:
          "Este e-mail não traz o texto da mensagem: consulte pelo painel.",
      };
      const identity = tenantEmailIdentity(tenant);

      await sendEmail({
        to: tenant.contacts.email,
        fromName: tenant.name,
        fromAddress: tenant.emailFrom,
        subject: text.subject,
        html: renderEmailCardHtml(text, identity, panelUrl),
        text: renderEmailCardText(text, panelUrl),
      });
    } catch (error) {
      console.error("email.requirement-reply", error);
    }
  });
}

export interface NotifyOfficeDataRightsSubmittedParams {
  tenant: Tenant;
  protocolNumber: string;
  right: DataRight;
}

/**
 * The office's nudge that a new LGPD requerimento landed, so the 15-day
 * legal clock (Lei 13.709/2018) does not run unwatched behind an
 * institutional inbox nobody opened. The right's legal name is fine to
 * name here (unlike the citizen-facing confirmation, there is no access
 * key standing between the office and its own panel), but the titular's
 * own description never rides this e-mail.
 */
export function notifyOfficeDataRightsSubmitted(
  params: NotifyOfficeDataRightsSubmittedParams,
): void {
  const { tenant, protocolNumber, right } = params;

  after(async () => {
    try {
      const host = tenant.hosts[0];
      const panelUrl = host
        ? `https://${host}/admin/lgpd/${protocolNumber}`
        : "";
      const legalName =
        DATA_RIGHT_OPTIONS.find((option) => option.id === right)?.legalName ??
        right;
      const text: EmailText = {
        subject: `Requerimento recebido · ${protocolNumber}`,
        paragraphs: [
          `Um novo requerimento LGPD foi registrado (${protocolNumber}), pedindo ${legalName.toLowerCase()}.`,
          "Consulte no painel para ver os detalhes e responder dentro do prazo legal de 15 dias.",
        ],
        buttonLabel: "Ver o requerimento",
        footnote:
          "Este e-mail não traz a descrição do pedido: consulte pelo painel.",
      };
      const identity = tenantEmailIdentity(tenant);

      await sendEmail({
        to: tenant.contacts.email,
        fromName: tenant.name,
        fromAddress: tenant.emailFrom,
        subject: text.subject,
        html: renderEmailCardHtml(text, identity, panelUrl),
        text: renderEmailCardText(text, panelUrl),
      });
    } catch (error) {
      console.error("email.data-rights-submitted", error);
    }
  });
}

export interface NotifyOfficeManifestationSubmittedParams {
  tenant: Tenant;
  protocolNumber: string;
  manifestationType: ManifestationType;
}

/**
 * The office's nudge that a new ouvidoria manifestation landed, fired the
 * same way whether the manifestation is anonymous, identified, or marked
 * confidential. The office's own contact is the destination either way, so
 * unlike `notifyCitizen` there is no missing-contact branch to consider.
 * Name, contact, and the manifestation's own text never ride this e-mail,
 * on purpose: naming an identified or confidential manifestante in a notice
 * that lands in a shared institutional inbox would leak exactly what the
 * sigilo option promises to keep off the record.
 */
export function notifyOfficeManifestationSubmitted(
  params: NotifyOfficeManifestationSubmittedParams,
): void {
  const { tenant, protocolNumber, manifestationType } = params;

  after(async () => {
    try {
      const host = tenant.hosts[0];
      const panelUrl = host
        ? `https://${host}/admin/ouvidoria/${protocolNumber}`
        : "";
      const text: EmailText = {
        subject: `Manifestação recebida · ${protocolNumber}`,
        paragraphs: [
          `Uma nova manifestação de ouvidoria foi registrada (${protocolNumber}), do tipo ${manifestationLabel(manifestationType).toLowerCase()}.`,
          "Consulte no painel para ver os detalhes.",
        ],
        buttonLabel: "Ver a manifestação",
        footnote:
          "Este e-mail não traz o texto da manifestação: consulte pelo painel.",
      };
      const identity = tenantEmailIdentity(tenant);

      await sendEmail({
        to: tenant.contacts.email,
        fromName: tenant.name,
        fromAddress: tenant.emailFrom,
        subject: text.subject,
        html: renderEmailCardHtml(text, identity, panelUrl),
        text: renderEmailCardText(text, panelUrl),
      });
    } catch (error) {
      console.error("email.manifestation-submitted", error);
    }
  });
}
