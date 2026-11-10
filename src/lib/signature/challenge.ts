import "server-only";
import { createHmac, hkdfSync, randomInt, timingSafeEqual } from "node:crypto";

/**
 * The second factor of a signature (decision of 10/11/2026): besides the
 * panel login and the certificate's password, a six-digit code sent to the
 * signer's own e-mail. Nothing is stored: the code's proof travels in a
 * signed, httpOnly cookie, bound to the person and the office, and lasts ten
 * minutes, during which the same code serves the signatures of that sitting.
 * Wrong guesses are limited per person (lib/rate-limit.ts).
 */

export const CODE_MINUTES = 10;

function key(): Buffer {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("Sem segredo para o código de assinatura.");
  return Buffer.from(
    hkdfSync("sha256", secret, "veridia", "signing-code/v1", 32),
  );
}

const mac = (text: string) =>
  createHmac("sha256", key()).update(text).digest("base64url");

interface Claims {
  u: string;
  t: string;
  exp: number;
  h: string;
}

/** A new code and the token that proves it, for the cookie. */
export function createSigningChallenge(
  userId: string,
  tenantSlug: string,
  now = new Date(),
): { code: string; token: string; expiresAt: Date } {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(now.getTime() + CODE_MINUTES * 60_000);
  const claims: Claims = {
    u: userId,
    t: tenantSlug,
    exp: expiresAt.getTime(),
    h: mac(`code:${userId}:${tenantSlug}:${code}`),
  };
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return { code, token: `${body}.${mac(`token:${body}`)}`, expiresAt };
}

/** Whether `code` is the one sent to this person, still in time. */
export function verifySigningChallenge(
  token: string | undefined,
  code: string,
  userId: string,
  tenantSlug: string,
  now = new Date(),
): "ok" | "missing" | "expired" | "wrong" {
  if (!token) return "missing";
  const [body, signature] = token.split(".");
  if (!body || !signature) return "missing";
  const expected = Buffer.from(mac(`token:${body}`));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return "missing";
  }
  let claims: Claims;
  try {
    claims = JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return "missing";
  }
  if (claims.u !== userId || claims.t !== tenantSlug) return "missing";
  if (claims.exp <= now.getTime()) return "expired";
  const typed = code.replace(/\D/g, "");
  const hash = Buffer.from(mac(`code:${userId}:${tenantSlug}:${typed}`));
  const stored = Buffer.from(claims.h);
  return hash.length === stored.length && timingSafeEqual(hash, stored)
    ? "ok"
    : "wrong";
}

/** "m***a@exemplo.com": where the code went, without spelling it out. */
export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const shown =
    name.length <= 2 ? `${name[0]}***` : `${name[0]}***${name.at(-1)}`;
  return `${shown}@${domain}`;
}
