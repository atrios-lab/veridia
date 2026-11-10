import "server-only";
import { cookies } from "next/headers";
import type { Tenant } from "@/core/tenant/schema.ts";
import { sendEmail } from "./email/send.ts";
import {
  CODE_MINUTES,
  createCodeChallenge,
  createMarker,
  maskEmail,
  verifyCodeChallenge,
  verifyMarker,
} from "./email-code.ts";
import { countWrongAccessCode, isAccessCodeLocked } from "./rate-limit.ts";

/**
 * The panel's second step at sign-in (decision of 10/11/2026): after the
 * password, a six-digit code sent to the account's e-mail. Confirmed once
 * per session: the marker cookie is bound to that session and lasts as long
 * as it does, so a new sign-in asks again. `getSession` (lib/session.ts)
 * refuses a session without the marker, which is what makes every screen,
 * action and route of the panel ask for it, not just the menu.
 *
 * `PANEL_ACCESS_CODE=off` turns the step off for the whole deploy: for the
 * day the e-mail provider is down and nobody could get in otherwise.
 */

const CHALLENGE_COOKIE = "painel-codigo";
const MARKER_COOKIE = "painel-acesso";

export function accessCodeEnabled(): boolean {
  return process.env.PANEL_ACCESS_CODE !== "off";
}

interface PendingSession {
  session: { id: string; expiresAt: Date | string };
  user: { id: string; email: string; name: string };
}

const bindingOf = (pending: PendingSession) =>
  `acesso:${pending.session.id}:${pending.user.id}`;

/** Whether this session already went through the e-mail code. */
export async function isAccessConfirmed(
  pending: PendingSession,
): Promise<boolean> {
  if (!accessCodeEnabled()) return true;
  const jar = await cookies();
  return verifyMarker(jar.get(MARKER_COOKIE)?.value, bindingOf(pending));
}

const secure = process.env.NODE_ENV === "production";

/** Sends the code to the account's e-mail; returns where, masked. */
export async function sendAccessCode(
  tenant: Tenant,
  pending: PendingSession,
): Promise<string> {
  const { code, token, expiresAt } = createCodeChallenge(bindingOf(pending));
  const jar = await cookies();
  jar.set(CHALLENGE_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/admin",
    expires: expiresAt,
  });
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  const name = pending.user.name;
  await sendEmail({
    to: pending.user.email,
    fromName: tenant.name,
    fromAddress: tenant.emailFrom,
    subject: `Código de acesso ao painel: ${spaced}`,
    text:
      `Olá, ${name}.\n\n` +
      `Seu código para entrar no painel do ${tenant.name} é ${spaced}. ` +
      `Ele vale por ${CODE_MINUTES} minutos.\n\n` +
      "Se não foi você quem tentou entrar, troque a sua senha e avise o administrador da serventia.",
    html:
      `<p>Olá, ${escapeHtml(name)}.</p>` +
      `<p>Seu código para entrar no painel do ${escapeHtml(tenant.name)} é:</p>` +
      `<p style="font-size:26px;font-weight:bold;letter-spacing:4px">${spaced}</p>` +
      `<p>Ele vale por ${CODE_MINUTES} minutos.</p>` +
      "<p>Se não foi você quem tentou entrar, troque a sua senha e avise o administrador da serventia.</p>",
  });
  return maskEmail(pending.user.email);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Checks the typed code; when right, marks the session as confirmed until
 * it ends. Undefined on success, otherwise the message for the screen.
 */
export async function confirmAccessCode(
  pending: PendingSession,
  code: string,
): Promise<string | undefined> {
  if (await isAccessCodeLocked(pending.user.id)) {
    return "Muitos códigos errados. Espere 10 minutos e peça um código novo.";
  }
  const jar = await cookies();
  const result = verifyCodeChallenge(
    jar.get(CHALLENGE_COOKIE)?.value,
    code,
    bindingOf(pending),
  );
  if (result === "wrong") {
    await countWrongAccessCode(pending.user.id);
    return "Código incorreto. Confira o e-mail e tente de novo.";
  }
  if (result === "expired") return "O código venceu. Peça um código novo.";
  if (result === "missing") return "Peça um código para entrar.";

  const until = new Date(pending.session.expiresAt);
  jar.set(MARKER_COOKIE, createMarker(bindingOf(pending), until), {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    expires: until,
  });
  // The code is spent: its cookie expires now.
  jar.set(CHALLENGE_COOKIE, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/admin",
    expires: new Date(0),
  });
  return undefined;
}
