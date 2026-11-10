import "server-only";
import { cookies } from "next/headers";
import {
  codeEmailFor,
  deviceEpochOf,
  needsAccessCode,
} from "@/core/auth/access-settings.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { getOfficeAccess } from "./access-settings.ts";
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
 * The panel's second step at sign-in (decisions of 10/11/2026):
 * - after the password, a six-digit code goes to the e-mail of the person
 *   signing in (the administrator may point it elsewhere, Configurações ›
 *   Duas etapas), and only to them;
 * - confirmed once per session; or, when the person ticks "salvar este
 *   computador", that browser stops asking until the administrator makes
 *   it forget;
 * - the first access (the invite, setting the password) and a password
 *   reset count as confirmed: the link came by e-mail already;
 * - the Átrios master account (superadmin) does not go through it.
 * `getSession` (lib/session.ts) refuses a session without it, so every
 * screen, action and route of the panel asks for it.
 *
 * `PANEL_ACCESS_CODE=off` turns the step off for the whole deploy: for the
 * day the e-mail provider is down and nobody could get in otherwise.
 */

const CHALLENGE_COOKIE = "painel-codigo";
const MARKER_COOKIE = "painel-acesso";
const DEVICE_COOKIE = "painel-computador";
/** How long a saved computer goes without asking. */
const DEVICE_DAYS = 365;

export function accessCodeEnabled(): boolean {
  return process.env.PANEL_ACCESS_CODE !== "off";
}

export interface PendingSession {
  session: { token: string; expiresAt: Date | string };
  user: {
    id: string;
    email: string;
    name: string;
    role?: string | null;
    tenantSlug?: string | null;
  };
}

const bindingOf = (token: string, userId: string) =>
  `acesso:${token}:${userId}`;
const deviceBinding = (userId: string, tenantSlug: string, epoch: number) =>
  `computador:${userId}:${tenantSlug}:${epoch}`;
const secure = process.env.NODE_ENV === "production";

/** Whether this session may use the panel without (more of) the code. */
export async function isAccessConfirmed(
  pending: PendingSession,
): Promise<boolean> {
  if (!accessCodeEnabled()) return true;
  if (!needsAccessCode(pending.user.role ?? "")) return true;
  const jar = await cookies();
  return verifyMarker(
    jar.get(MARKER_COOKIE)?.value,
    bindingOf(pending.session.token, pending.user.id),
  );
}

/** Session length, as lib/auth.ts sets it: eight hours. */
const SESSION_MS = 8 * 60 * 60 * 1000;

/**
 * At sign-in: a computer the person saved confirms the new session at once.
 * Checked here, once, so that "pedir o código de novo" (the administrator
 * making saved computers forget) ends at the next sign-in, never in the
 * middle of someone's work. True when the session is confirmed.
 */
export async function confirmBySavedComputer(
  token: string,
  user: { id: string; role: string; tenantSlug: string },
): Promise<boolean> {
  if (!accessCodeEnabled() || !needsAccessCode(user.role)) return true;
  const jar = await cookies();
  const device = jar.get(DEVICE_COOKIE)?.value;
  if (!device) return false;
  const access = await getOfficeAccess(user.tenantSlug);
  const saved = verifyMarker(
    device,
    deviceBinding(user.id, user.tenantSlug, deviceEpochOf(access, user.id)),
  );
  if (!saved) return false;
  await markAccessConfirmed(token, user.id, new Date(Date.now() + SESSION_MS));
  return true;
}

/**
 * Marks the session as confirmed: after the code, and right after the
 * invite or a password reset, whose link already came by e-mail.
 */
export async function markAccessConfirmed(
  token: string,
  userId: string,
  until: Date,
): Promise<void> {
  const jar = await cookies();
  jar.set(MARKER_COOKIE, createMarker(bindingOf(token, userId), until), {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    expires: until,
  });
}

/** Sends the code to this person's verification e-mail; returns where, masked. */
export async function sendAccessCode(
  tenant: Tenant,
  pending: PendingSession,
): Promise<string> {
  const { code, token, expiresAt } = createCodeChallenge(
    bindingOf(pending.session.token, pending.user.id),
  );
  const jar = await cookies();
  jar.set(CHALLENGE_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/admin",
    expires: expiresAt,
  });
  const access = await getOfficeAccess(tenant.slug);
  const to = codeEmailFor(access, pending.user.id, pending.user.email);
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  const name = pending.user.name;
  await sendEmail({
    to,
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
  return maskEmail(to);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Checks the typed code; when right, marks the session as confirmed and,
 * when asked, saves this computer. Undefined on success, otherwise the
 * message for the screen.
 */
export async function confirmAccessCode(
  pending: PendingSession,
  code: string,
  saveComputer: boolean,
): Promise<string | undefined> {
  if (await isAccessCodeLocked(pending.user.id)) {
    return "Muitos códigos errados. Espere 10 minutos e peça um código novo.";
  }
  const jar = await cookies();
  const result = verifyCodeChallenge(
    jar.get(CHALLENGE_COOKIE)?.value,
    code,
    bindingOf(pending.session.token, pending.user.id),
  );
  if (result === "wrong") {
    await countWrongAccessCode(pending.user.id);
    return "Código incorreto. Confira o e-mail e tente de novo.";
  }
  if (result === "expired") return "O código venceu. Peça um código novo.";
  if (result === "missing") return "Peça um código para entrar.";

  await markAccessConfirmed(
    pending.session.token,
    pending.user.id,
    new Date(pending.session.expiresAt),
  );
  if (saveComputer) {
    const tenantSlug = pending.user.tenantSlug ?? "";
    const access = await getOfficeAccess(tenantSlug);
    const until = new Date(Date.now() + DEVICE_DAYS * 24 * 60 * 60 * 1000);
    jar.set(
      DEVICE_COOKIE,
      createMarker(
        deviceBinding(
          pending.user.id,
          tenantSlug,
          deviceEpochOf(access, pending.user.id),
        ),
        until,
      ),
      { httpOnly: true, secure, sameSite: "lax", path: "/", expires: until },
    );
  }
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
