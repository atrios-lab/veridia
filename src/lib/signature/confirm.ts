import "server-only";
import { cookies } from "next/headers";
import type { Tenant } from "@/core/tenant/schema.ts";
import { sendEmail } from "@/lib/email/send.ts";
import {
  countWrongSigningCode,
  isSigningCodeLocked,
} from "@/lib/rate-limit.ts";
import {
  CODE_MINUTES,
  createSigningChallenge,
  maskEmail,
  verifySigningChallenge,
} from "./challenge.ts";

const COOKIE = "assinatura-codigo";

/**
 * Sends the six-digit code to the signer's own e-mail and keeps its proof
 * in an httpOnly cookie. Returns where it went, masked, for the screen.
 */
export async function sendSigningCode(
  tenant: Tenant,
  user: { id: string; email: string; name: string },
): Promise<string> {
  const { code, token, expiresAt } = createSigningChallenge(
    user.id,
    tenant.slug,
  );
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/admin",
    expires: expiresAt,
  });
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  await sendEmail({
    to: user.email,
    fromName: tenant.name,
    fromAddress: tenant.emailFrom,
    subject: `Código para assinar documentos: ${spaced}`,
    text:
      `Olá, ${user.name}.\n\n` +
      `Seu código para assinar documentos digitalmente no painel do ${tenant.name} é ${spaced}. ` +
      `Ele vale por ${CODE_MINUTES} minutos.\n\n` +
      "Se não foi você quem pediu, não informe este código a ninguém e avise o administrador da serventia: " +
      "alguém pode estar usando o seu acesso ao painel.",
    html:
      `<p>Olá, ${escapeHtml(user.name)}.</p>` +
      `<p>Seu código para assinar documentos digitalmente no painel do ${escapeHtml(tenant.name)} é:</p>` +
      `<p style="font-size:26px;font-weight:bold;letter-spacing:4px">${spaced}</p>` +
      `<p>Ele vale por ${CODE_MINUTES} minutos.</p>` +
      "<p>Se não foi você quem pediu, não informe este código a ninguém e avise o administrador da serventia: alguém pode estar usando o seu acesso ao painel.</p>",
  });
  return maskEmail(user.email);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * The check every signing action runs first. Undefined when the code is
 * right; otherwise the message for the screen.
 */
export async function checkSigningCode(
  tenant: Tenant,
  userId: string,
  code: string,
): Promise<string | undefined> {
  if (await isSigningCodeLocked(userId)) {
    return "Muitos códigos errados. Espere 10 minutos e peça um código novo.";
  }
  const jar = await cookies();
  const result = verifySigningChallenge(
    jar.get(COOKIE)?.value,
    code,
    userId,
    tenant.slug,
  );
  if (result === "ok") return undefined;
  if (result === "wrong") {
    await countWrongSigningCode(userId);
    return "Código de confirmação incorreto.";
  }
  if (result === "expired") {
    return "O código venceu. Peça um código novo.";
  }
  return "Peça o código de confirmação no seu e-mail antes de assinar.";
}
