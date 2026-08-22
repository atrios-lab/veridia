import "server-only";

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

  const response = await fetch(POSTMARK_ENDPOINT, {
    method: "POST",
    headers: {
      "X-Postmark-Server-Token": token,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      From: `${email.fromName} <${email.fromAddress ?? FROM_ADDRESS}>`,
      To: email.to,
      Subject: email.subject,
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
