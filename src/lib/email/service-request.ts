import "server-only";
import { after } from "next/server";
import { isEmailContact } from "@/core/request/form.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { renderNoticeEmailHtml } from "./render.ts";
import { sendEmail } from "./send.ts";

/**
 * The office nudging a citizen about their own protocol.
 *
 * Two rules hold every one of these together. First, the message never
 * carries the content: not the requirement's text, not the office's reply,
 * not the delivered file. What is behind the access key stays behind it, and
 * an e-mail is the one channel the office cannot vouch for. Second, sending is
 * best effort: the notice is a courtesy on top of a consult that already works,
 * so a mail provider having a bad minute must never be why an exigência failed
 * to register.
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
 * Returns before the message is sent, and swallows its own failure into a
 * log: the caller has nothing to await and nothing to catch, per the "best
 * effort" half of the contract above.
 *
 * The send is handed to `after` rather than left as a floating promise. On a
 * platform function the response ends the invocation, and a fetch still in
 * flight is suspended with it: the socket then times out unnoticed, and the
 * error only surfaces minutes later, on whatever unrelated request happens
 * to wake that instance. `after` is what keeps the invocation alive until
 * the send finishes.
 */
export function notifyCitizen(params: NotifyCitizenParams): void {
  // A phone number is a valid contact for a request and not a mailbox. The
  // office reaches those the way it always did, by calling.
  const contact = params.contact;
  if (!contact || !isEmailContact(contact)) return;

  const host = params.tenant.hosts[0];
  after(async () => {
    try {
      await sendEmail({
        to: contact.trim(),
        fromName: params.tenant.name,
        fromAddress: params.tenant.emailFrom,
        subject: `${params.subject} · ${params.protocolNumber}`,
        html: renderNoticeEmailHtml({
          officeName: params.tenant.name,
          officeSubtitle: params.tenant.subtitle,
          sealUrl: host
            ? `https://${host}${params.tenant.logos.seal.light}`
            : "",
          body: params.body,
          protocolNumber: params.protocolNumber,
          consultUrl: host ? `https://${host}/protocolo` : "",
        }),
        text: plainText(params),
      });
    } catch (error) {
      console.error("email.notify-citizen", error);
    }
  });
}
