import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

/**
 * The A1 file at rest: AES-256-GCM on top of the file's own password (which
 * is never stored). The key is `SIGNING_VAULT_KEY` (32 bytes, base64) when
 * the deploy sets one, or else derived from `BETTER_AUTH_SECRET` (HKDF), so
 * a database copy alone opens nothing. Rotating that secret makes the stored
 * certificates unreadable: the office uploads them again.
 */

function key(): Buffer {
  const own = process.env.SIGNING_VAULT_KEY;
  if (own) {
    const bytes = Buffer.from(own, "base64");
    if (bytes.length !== 32) {
      throw new Error("SIGNING_VAULT_KEY precisa ter 32 bytes em base64.");
    }
    return bytes;
  }
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("Sem chave para o cofre dos certificados.");
  return Buffer.from(
    hkdfSync("sha256", secret, "veridia", "signing-certificates/v1", 32),
  );
}

export function sealCertificate(pfx: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(pfx), cipher.final()]);
  return `v1.${Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64")}`;
}

export function openSealedCertificate(sealed: string): Buffer {
  if (!sealed.startsWith("v1."))
    throw new Error("Cofre em formato desconhecido.");
  const raw = Buffer.from(sealed.slice(3), "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
}
