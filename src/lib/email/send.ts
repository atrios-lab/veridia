import "server-only";
import { resolveRecipient } from "@/core/email/recipient.ts";
import { AddressDoesNotReceiveError, findPermanentBounce } from "./bounces.ts";

export interface EmailAttachment {
  filename: string;
  /** The file's bytes as text. Only text formats are attached today (.ics). */
  content: string;
}

export interface OutgoingEmail {
  to: string;
  /** Display name shown to the recipient, the tenant's own name. */
  fromName: string;
  /**
   * Tenant's own sending address (`tenant.emailFrom`). Its domain must be
   * verified in Postmark; absent, the platform-wide fallback below is used.
   */
  fromAddress?: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
}

const POSTMARK_ENDPOINT = "https://api.postmarkapp.com/email";

// Platform-wide fallback sender, used when the tenant has no `emailFrom`
// of its own (i.e. its domain is not yet verified in Postmark).
const FROM_ADDRESS =
  process.env.EMAIL_FROM_ADDRESS ?? "nao-responda@atrioss.com";

// Set only where the deployment is not the real thing: every message goes to
// this one inbox instead of to the address on the record. See
// `resolveRecipient` for why a staging environment mailing made-up addresses
// is a problem for every serventia at once, not just for that message.
const REDIRECT_TO = process.env.EMAIL_REDIRECT_TO;

/**
 * Sends through Postmark's HTTP API when `POSTMARK_SERVER_TOKEN` is set;
 * otherwise logs what would have been sent instead of failing. Same posture
 * as `isRateLimited` without Upstash configured: development and CI stay
 * functional with no provider credential.
 */
export async function sendEmail(email: OutgoingEmail): Promise<void> {
  const token = process.env.POSTMARK_SERVER_TOKEN;
  if (!token) {
    console.log(
      `[email] sem POSTMARK_SERVER_TOKEN: registrando em vez de enviar.\n` +
        `Para: ${email.to}\nAssunto: ${email.subject}\n\n${email.text}`,
    );
    return;
  }

  const recipient = resolveRecipient(email.to, email.subject, REDIRECT_TO);
  if (recipient.redirected) {
    // Loud on purpose, once per message: this variable reaching production
    // would take every serventia's mail off its way to the citizen without
    // a single error, and the log is the only place that would show it.
    console.warn(
      `[email] EMAIL_REDIRECT_TO ativo: ${email.to} desviado para ${recipient.to}.`,
    );
  }

  // Checked on the resolved recipient, after resolveRecipient: a test
  // deployment's inbox must not be blocked by a bounce belonging to the
  // made-up address the message was originally aimed at.
  //
  // Refused here rather than left for the provider to refuse. The message
  // does not go out either way, but this way there is no network call, the
  // attempt does not count against the account's bounce rate (the number
  // that, past ten per cent, silences every serventia), and what reaches the
  // screen is the receiving server's own reason instead of the provider's
  // generic "não aceitou o envio".
  const bounced = await findPermanentBounce(recipient.to);
  if (bounced) {
    throw new AddressDoesNotReceiveError(recipient.to, bounced.detail);
  }

  const response = await fetch(POSTMARK_ENDPOINT, {
    method: "POST",
    headers: {
      "X-Postmark-Server-Token": token,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      From: `${email.fromName} <${email.fromAddress ?? FROM_ADDRESS}>`,
      To: recipient.to,
      Subject: recipient.subject,
      HtmlBody: email.html,
      TextBody: email.text,
      MessageStream: "outbound",
      // Postmark takes attachment bytes base64 encoded.
      ...(email.attachments?.length
        ? {
            Attachments: email.attachments.map((file) => ({
              Name: file.filename,
              Content: Buffer.from(file.content, "utf8").toString("base64"),
              // ponytail: only .ics is attached today; branch on extension
              // if another format ever shows up.
              ContentType: "text/calendar",
            })),
          }
        : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Falha ao enviar e-mail via Postmark (${response.status}): ${await response.text()}`,
    );
  }
}
