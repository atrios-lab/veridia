import { formatCpf, isValidCpf, normalizeCpf } from "./request/form.ts";
import { formatCnpj, isValidCnpj } from "./tenant/pix.ts";

/**
 * A CPF or CNPJ typed with or without punctuation, formatted as it is
 * typed (decision of 11/11/2026): up to 11 digits it is a CPF
 * (000.000.000-00), past that a CNPJ (00.000.000/0000-00).
 */
export function formatTaxId(value: string): string {
  const digits = normalizeCpf(value).slice(0, 14);
  return digits.length <= 11 ? formatCpf(digits) : formatCnpj(digits);
}

/** Empty is fine (not filled in yet); anything else must be a real one. */
export function isValidTaxId(value: string): boolean {
  const digits = normalizeCpf(value);
  if (!digits) return true;
  return digits.length === 11 ? isValidCpf(digits) : isValidCnpj(digits);
}
