import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The seal of the shareable proof of protocol (decision of 22/11/2026): a
 * short HMAC of the office and the protocol, so the QR opens a page that
 * shows the request's summary and andamento without the access key, and
 * nobody can list other protocols by guessing numbers. It opens nothing
 * else: no documents, no actions, no ciência.
 */
export function protocolProofSeal(
  key: Buffer,
  tenantSlug: string,
  protocolNumber: string,
): string {
  return createHmac("sha256", key)
    .update(`${tenantSlug}:${protocolNumber}`)
    .digest("base64url")
    .slice(0, 22);
}

/** Constant time, so a seal cannot be narrowed down by timing it. */
export function verifyProtocolProofSeal(
  key: Buffer,
  tenantSlug: string,
  protocolNumber: string,
  seal: string,
): boolean {
  const expected = Buffer.from(
    protocolProofSeal(key, tenantSlug, protocolNumber),
  );
  const given = Buffer.from(seal);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** The page the proof's QR opens. */
export function protocolProofLink(
  origin: string,
  protocolNumber: string,
  seal: string,
): string {
  return `${origin}/protocolo/comprovante?numero=${encodeURIComponent(protocolNumber)}&selo=${encodeURIComponent(seal)}`;
}
