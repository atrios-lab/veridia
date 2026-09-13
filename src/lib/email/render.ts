import type { EmailText } from "@/core/email/text.ts";
import { brandImageUrl } from "@/core/tenant/brand-image.ts";
import { EMAIL_PALETTE } from "@/core/tenant/palette.ts";
import type { Tenant } from "@/core/tenant/schema.ts";

export interface EmailTenantIdentity {
  name: string;
  subtitle: string;
  /** Absolute URL: an e-mail client cannot resolve a path relative to the app. */
  sealUrl: string;
}

/** The tenant fields every outgoing e-mail's header shows, from the full `Tenant`. */
export function tenantEmailIdentity(tenant: Tenant): EmailTenantIdentity {
  const host = tenant.hosts[0];
  if (!host) {
    throw new Error(`Serventia "${tenant.slug}" não tem host registrado.`);
  }
  return {
    name: tenant.name,
    subtitle: tenant.subtitle,
    // The seal for a light background (dark ink), same one the invite e-mail
    // mockup uses on its white body: see tenant.logos.seal in schema.ts.
    sealUrl: brandImageUrl(tenant.logos.seal.light, host),
  };
}

// Fixed institutional palette, not the tenant's live `--brand-*` theme: an
// e-mail client cannot read a CSS variable, and threading five theme palettes
// into the markup is work no recipient would notice. The values live in
// `palette.ts` because that is the one module allowed to write a colour down
// (see scripts/check-tokens.mjs); same posture as src/lib/pdf.ts.
const COLORS = EMAIL_PALETTE;

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

/** The HTML body sent to the recipient's inbox. */
export function renderEmailCardHtml(
  text: EmailText,
  tenant: EmailTenantIdentity,
  actionUrl: string,
): string {
  const paragraphs = text.paragraphs
    .map(
      (paragraph) =>
        `<p style="font-size:14px;color:${COLORS.text};line-height:1.65;margin:0 0 16px;">${escapeHtml(paragraph)}</p>`,
    )
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:32px 16px;background:${COLORS.background};font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:14px;border-collapse:separate;overflow:hidden;">
      <tr>
        <td style="padding:24px 28px;border-bottom:1px solid ${COLORS.border};">
          <img src="${escapeHtml(tenant.sealUrl)}" alt="" width="38" height="38" style="display:block;object-fit:contain;">
        </td>
      </tr>
      <tr>
        <td style="padding:30px 28px 32px;">
          <p style="font-size:17px;font-weight:700;color:${COLORS.primary};margin:0 0 4px;">${escapeHtml(tenant.name)}</p>
          <p style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${COLORS.muted};margin:0 0 20px;">${escapeHtml(tenant.subtitle)}</p>
          ${paragraphs}
          <a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:${COLORS.button};color:${COLORS.card};font-size:14px;font-weight:700;border-radius:9px;padding:13px 24px;text-decoration:none;margin:4px 0 20px;">${escapeHtml(text.buttonLabel)}</a>
          <p style="font-size:12px;color:${COLORS.muted};line-height:1.6;border-top:1px solid ${COLORS.border};padding-top:14px;margin:0;">${escapeHtml(text.footnote)}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Plain-text fallback for clients that do not render HTML. */
export function renderEmailCardText(
  text: EmailText,
  actionUrl: string,
): string {
  return [
    ...text.paragraphs,
    `${text.buttonLabel}: ${actionUrl}`,
    text.footnote,
  ].join("\n\n");
}

export interface NoticeEmail {
  officeName: string;
  officeSubtitle: string;
  sealUrl: string;
  /** One line: what happened, never what it says. */
  body: string;
  protocolNumber: string;
  /** Where the citizen goes to read it, behind their key. */
  consultUrl: string;
}

/**
 * A notice about a protocol. Same shell as the account e-mail above, one
 * paragraph instead of several, and the protocol number set apart so it can be
 * read off a phone at a glance. The button leads to the consult, never to the
 * content: the key is what opens that, and the key is not in here.
 */
export function renderNoticeEmailHtml(notice: NoticeEmail): string {
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:32px 16px;background:${COLORS.background};font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:14px;border-collapse:separate;overflow:hidden;">
      <tr>
        <td style="padding:24px 28px;border-bottom:1px solid ${COLORS.border};">
          <img src="${escapeHtml(notice.sealUrl)}" alt="" width="38" height="38" style="display:block;object-fit:contain;">
        </td>
      </tr>
      <tr>
        <td style="padding:30px 28px 32px;">
          <p style="font-size:17px;font-weight:700;color:${COLORS.primary};margin:0 0 4px;">${escapeHtml(notice.officeName)}</p>
          <p style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${COLORS.muted};margin:0 0 20px;">${escapeHtml(notice.officeSubtitle)}</p>
          <p style="font-size:14px;color:${COLORS.text};line-height:1.65;margin:0 0 16px;">${escapeHtml(notice.body)}</p>
          <p style="font-size:13px;color:${COLORS.muted};margin:0 0 20px;">Protocolo <strong style="color:${COLORS.primary};font-size:15px;">${escapeHtml(notice.protocolNumber)}</strong></p>
          <a href="${escapeHtml(notice.consultUrl)}" style="display:inline-block;background:${COLORS.button};color:${COLORS.card};font-size:14px;font-weight:700;border-radius:9px;padding:13px 24px;text-decoration:none;margin:0 0 20px;">Consultar o protocolo</a>
          <p style="font-size:12px;color:${COLORS.muted};line-height:1.6;border-top:1px solid ${COLORS.border};padding-top:14px;margin:0;">Para ver os detalhes, informe o protocolo e a sua chave de acesso na consulta. Este aviso não traz o conteúdo por segurança.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export interface AccessKeyEmail {
  officeName: string;
  officeSubtitle: string;
  sealUrl: string;
  protocolNumber: string;
  /** In the clear, in the one message whose job is to carry it. */
  accessKey: string;
  consultUrl: string;
  /** "received": the pedido just filed. "recovered": the citizen asked the
   * consult page for a new key, and the previous one just stopped working. */
  reason: "received" | "recovered";
}

const ACCESS_KEY_INTRO: Record<AccessKeyEmail["reason"], string> = {
  received:
    "Recebemos o seu pedido. Guarde este e-mail: é com ele que você acompanha o andamento.",
  recovered: "Uma chave de acesso nova foi gerada para o seu pedido.",
};

/**
 * Same footnote every notice carries about the consult, plus what only this
 * e-mail is allowed to add: the credential itself, and (only when a key
 * that already existed was just replaced) the two sentences that make the
 * substitution legible to whoever is reading it. A citizen who filed a
 * pedido gets no such sentence: there was no previous key to lose.
 */
function accessKeyFootnote(reason: AccessKeyEmail["reason"]): string {
  const base =
    "Guarde este e-mail: é com o protocolo e a chave que você acompanha o pedido. Não compartilhe a chave com ninguém, nem com a serventia.";
  if (reason === "received") return base;
  return `${base} A chave anterior deixou de valer. Se você não pediu uma chave nova, alguém informou o seu protocolo e o seu e-mail na consulta; a chave só chega aqui, então o seu pedido continua só seu.`;
}

/**
 * The one e-mail (in two moments: filing, and recovery) allowed to carry the
 * access key in the clear. Same shell as `renderNoticeEmailHtml`, but the
 * credential itself replaces the one-line body, in its own block, in a
 * monospaced size that reads off a phone screen without zooming.
 */
export function renderAccessKeyEmailHtml(email: AccessKeyEmail): string {
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:32px 16px;background:${COLORS.background};font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:14px;border-collapse:separate;overflow:hidden;">
      <tr>
        <td style="padding:24px 28px;border-bottom:1px solid ${COLORS.border};">
          <img src="${escapeHtml(email.sealUrl)}" alt="" width="38" height="38" style="display:block;object-fit:contain;">
        </td>
      </tr>
      <tr>
        <td style="padding:30px 28px 32px;">
          <p style="font-size:17px;font-weight:700;color:${COLORS.primary};margin:0 0 4px;">${escapeHtml(email.officeName)}</p>
          <p style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${COLORS.muted};margin:0 0 20px;">${escapeHtml(email.officeSubtitle)}</p>
          <p style="font-size:14px;color:${COLORS.text};line-height:1.65;margin:0 0 20px;">${escapeHtml(ACCESS_KEY_INTRO[email.reason])}</p>
          <div style="margin:0 0 20px;padding:16px 18px;border-radius:10px;background:${COLORS.background};border:1px solid ${COLORS.border};">
            <p style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${COLORS.muted};margin:0 0 4px;">Protocolo</p>
            <p style="font-size:16px;font-weight:700;font-family:'Courier New',monospace;letter-spacing:.04em;color:${COLORS.primary};margin:0 0 14px;">${escapeHtml(email.protocolNumber)}</p>
            <p style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${COLORS.muted};margin:0 0 4px;">Chave de acesso</p>
            <p style="font-size:19px;font-weight:700;font-family:'Courier New',monospace;letter-spacing:.1em;color:${COLORS.primary};margin:0;">${escapeHtml(email.accessKey)}</p>
          </div>
          <a href="${escapeHtml(email.consultUrl)}" style="display:inline-block;background:${COLORS.button};color:${COLORS.card};font-size:14px;font-weight:700;border-radius:9px;padding:13px 24px;text-decoration:none;margin:0 0 20px;">Consultar o protocolo</a>
          <p style="font-size:12px;color:${COLORS.muted};line-height:1.6;border-top:1px solid ${COLORS.border};padding-top:14px;margin:0;">${escapeHtml(accessKeyFootnote(email.reason))}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Plain-text fallback for `renderAccessKeyEmailHtml`, same content. */
export function renderAccessKeyEmailText(email: AccessKeyEmail): string {
  return [
    ACCESS_KEY_INTRO[email.reason],
    "",
    `Protocolo: ${email.protocolNumber}`,
    `Chave de acesso: ${email.accessKey}`,
    "",
    `Consultar o protocolo: ${email.consultUrl}`,
    "",
    accessKeyFootnote(email.reason),
  ].join("\n");
}
