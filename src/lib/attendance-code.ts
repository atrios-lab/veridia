import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The validation code of an attendance declaration: an HMAC of the office
 * and the appointment, so the address in the QR cannot be made up for an
 * appointment nobody attended, and no table has to keep codes. Derived from
 * BETTER_AUTH_SECRET with its own label, the same way `pdf-link-key.ts` is.
 */
const secret =
  process.env.BETTER_AUTH_SECRET || "test-sem-valor-nenhum-fora-deste-processo";
const key = createHmac("sha256", secret)
  .update("veridia:comparecimento")
  .digest();

/** Ten characters: short enough to type from paper, long enough never to
 * be guessed (31^10). */
const CODE_LENGTH = 10;

/** Letters and digits a person can read off paper without doubt: no 0/O,
 * no 1/I/L, and no "-" or "_" at the start of a code. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function attendanceCode(
  tenantSlug: string,
  appointmentId: string,
): string {
  const digest = createHmac("sha256", key)
    .update(`${tenantSlug}:${appointmentId}`)
    .digest();
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[digest[i] % ALPHABET.length];
  }
  return code;
}

/** The last segment of the validation address: "<id>.<code>". */
export function attendanceToken(
  tenantSlug: string,
  appointmentId: string,
): string {
  return `${appointmentId}.${attendanceCode(tenantSlug, appointmentId)}`;
}

/** The appointment id a token names, when its code checks out. */
export function verifyAttendanceToken(
  tenantSlug: string,
  token: string,
): string | undefined {
  const [id, code] = token.split(".");
  if (!id || !code || !/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  const expected = Buffer.from(attendanceCode(tenantSlug, id));
  const given = Buffer.from(code);
  if (expected.length !== given.length) return undefined;
  return timingSafeEqual(expected, given) ? id : undefined;
}

/** Where the QR leads, on the office's own site. */
export function attendanceUrl(
  origin: string,
  tenantSlug: string,
  appointmentId: string,
): string {
  return `${origin}/comparecimento/${attendanceToken(tenantSlug, appointmentId)}`;
}
