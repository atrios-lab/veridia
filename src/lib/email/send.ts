import "server-only";

export interface OutgoingEmail {
  to: string;
  /** Display name only — the technical sending address is platform-wide. */
  fromName: string;
  subject: string;
  html: string;
  text: string;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

// Single verified sending domain for the whole platform: verifying SPF/DKIM
// for each serventia's own domain is out of scope for this delivery (see
// design.md, "Remetente único da plataforma"). What the recipient sees
// still varies — `fromName` carries the tenant's own name — only the
// technical domain is shared across every office.
const FROM_ADDRESS =
  process.env.EMAIL_FROM_ADDRESS ?? "nao-responda@notificacoes.veridia.app";

function configured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * Sends through Resend's HTTP API when `RESEND_API_KEY` is set; otherwise
 * logs what would have been sent instead of failing. Same posture as
 * `isRateLimited` without Upstash configured: development and CI stay
 * functional with no provider credential.
 */
export async function sendEmail(email: OutgoingEmail): Promise<void> {
  if (!configured()) {
    console.log(
      `[email] sem RESEND_API_KEY — registrando em vez de enviar.\n` +
        `Para: ${email.to}\nAssunto: ${email.subject}\n\n${email.text}`,
    );
    return;
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${email.fromName} <${FROM_ADDRESS}>`,
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Falha ao enviar e-mail via Resend (${response.status}): ${await response.text()}`,
    );
  }
}
