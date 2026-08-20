import { PIX_CITY_MAX_LENGTH } from "../tenant/pix.ts";

/**
 * Pix EMV ("Copia e Cola") static charge payload: the Central Bank's BR
 * Code format, written by hand with the same discipline as
 * `../tenant/pix.ts`: a short, stable public standard that does not change,
 * not worth a dependency for.
 */

const GUI = "br.gov.bcb.pix";
const MERCHANT_CATEGORY_CODE = "0000";
const CURRENCY_BRL = "986";
const COUNTRY_BR = "BR";
const MERCHANT_NAME_MAX_LENGTH = 25;
const TXID_MAX_LENGTH = 25;

function tlv(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, "0")}${value}`;
}

/**
 * CRC16-CCITT (polynomial `0x1021`, initial value `0xFFFF`, no reflection,
 * no final XOR): the checksum the Pix payload standard requires in its
 * last field, computed over everything before it (including the `6304`
 * field id and length of the CRC field itself).
 */
export function crc16Ccitt(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc =
        (crc & 0x8000) !== 0
          ? ((crc << 1) ^ 0x1021) & 0xffff
          : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Upper case, unaccented, alphanumeric-and-space: the alphabet the
 * standard's merchant fields accept, truncated to that field's own limit.
 */
function sanitizeMerchantField(value: string, maxLength: number): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .trim()
    .slice(0, maxLength);
}

/**
 * `REQ.2026.000148` -> `REQ2026000148`: already unique per office per year,
 * so the protocol number doubles as the transaction id without minting a
 * new identifier.
 */
export function deriveTxId(protocolNumber: string): string {
  return protocolNumber.replace(/[^a-zA-Z0-9]/g, "").slice(0, TXID_MAX_LENGTH);
}

/**
 * Whether a charge can be built at all. Needs the amount, the office's Pix
 * key and its city all at once: missing any one of the three means "no
 * charge available", never a broken or partial payload. Pure and separate
 * from `buildPixCharge` so callers (and tests) can decide whether to render
 * a QR at all without going near the rendering dependency.
 */
export function canBuildPixCharge(input: {
  amountCents?: number;
  pixKey?: string;
  city?: string;
}): boolean {
  return (
    input.amountCents != null && Boolean(input.pixKey) && Boolean(input.city)
  );
}

export interface PixChargeInput {
  /** Already normalized: see `normalizePixKey` in `../tenant/pix.ts`. */
  pixKey: string;
  /** Already normalized: see `normalizePixCity` in `../tenant/pix.ts`. */
  city: string;
  /** The office's own name, sanitized here to the standard's alphabet. */
  merchantName: string;
  amountCents: number;
  protocolNumber: string;
}

/**
 * Builds a static Pix charge (initiation point `11`): the same category of
 * QR a small shop prints with a fixed price, not a dynamic one pointing at a
 * PSP endpoint. Pure transform, no I/O: four already-known values in,
 * one "Copia e Cola" string out.
 */
export function buildPixCharge(input: PixChargeInput): string {
  const merchantAccountInfo = tlv("00", GUI) + tlv("01", input.pixKey);
  const additionalData = tlv("05", deriveTxId(input.protocolNumber));
  const amount = (input.amountCents / 100).toFixed(2);

  const body =
    tlv("00", "01") +
    tlv("26", merchantAccountInfo) +
    tlv("52", MERCHANT_CATEGORY_CODE) +
    tlv("53", CURRENCY_BRL) +
    tlv("54", amount) +
    tlv("58", COUNTRY_BR) +
    tlv(
      "59",
      sanitizeMerchantField(input.merchantName, MERCHANT_NAME_MAX_LENGTH),
    ) +
    tlv("60", sanitizeMerchantField(input.city, PIX_CITY_MAX_LENGTH)) +
    tlv("62", additionalData);

  const withCrcTag = `${body}6304`;
  return `${withCrcTag}${crc16Ccitt(withCrcTag)}`;
}
