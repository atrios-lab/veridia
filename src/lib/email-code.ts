import "server-only";
import { createHmac, hkdfSync, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Six-digit codes sent by e-mail, with nothing stored: the code's proof
 * travels in a signed cookie, bound to whatever `binding` names (the panel
 * session, for the access check). And the marker set once a code is right,
 * bound the same way. Both are HMACs with a key derived from the auth
 * secret, so a cookie made by hand, or moved to another session, is refused.
 */

export const CODE_MINUTES = 10;

function key(): Buffer {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("Sem segredo para o código de acesso.");
  return Buffer.from(
    hkdfSync("sha256", secret, "veridia", "email-code/v1", 32),
  );
}

const mac = (text: string) =>
  createHmac("sha256", key()).update(text).digest("base64url");

function sameText(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function sealClaims(claims: object): string {
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${body}.${mac(`token:${body}`)}`;
}

function openClaims<T>(token: string | undefined): T | undefined {
  if (!token) return undefined;
  const [body, signature] = token.split(".");
  if (!body || !signature || !sameText(signature, mac(`token:${body}`))) {
    return undefined;
  }
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString()) as T;
  } catch {
    return undefined;
  }
}

/** A new code and the token that proves it, for the cookie. */
export function createCodeChallenge(
  binding: string,
  now = new Date(),
): { code: string; token: string; expiresAt: Date } {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(now.getTime() + CODE_MINUTES * 60_000);
  const token = sealClaims({
    b: binding,
    exp: expiresAt.getTime(),
    h: mac(`code:${binding}:${code}`),
  });
  return { code, token, expiresAt };
}

/** Whether `code` is the one sent for this binding, still in time. */
export function verifyCodeChallenge(
  token: string | undefined,
  code: string,
  binding: string,
  now = new Date(),
): "ok" | "missing" | "expired" | "wrong" {
  const claims = openClaims<{ b: string; exp: number; h: string }>(token);
  if (!claims || claims.b !== binding) return "missing";
  if (claims.exp <= now.getTime()) return "expired";
  const typed = code.replace(/\D/g, "");
  return sameText(mac(`code:${binding}:${typed}`), claims.h) ? "ok" : "wrong";
}

/** The "already confirmed" marker, valid until `expiresAt`. */
export function createMarker(binding: string, expiresAt: Date): string {
  return sealClaims({ m: binding, exp: expiresAt.getTime() });
}

export function verifyMarker(
  token: string | undefined,
  binding: string,
  now = new Date(),
): boolean {
  const claims = openClaims<{ m: string; exp: number }>(token);
  return Boolean(claims && claims.m === binding && claims.exp > now.getTime());
}

/** "m***a@exemplo.com": where the code went, without spelling it out. */
export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const shown =
    name.length <= 2 ? `${name[0]}***` : `${name[0]}***${name.at(-1)}`;
  return `${shown}@${domain}`;
}
