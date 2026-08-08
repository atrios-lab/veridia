import { z } from "zod";
import { isValidCpf, normalizeCpf } from "../request/form.ts";

// The five key types the Central Bank's Pix system accepts. "random" is what
// the Central Bank calls an EVP: a UUID it issues, not chosen by the office.
export const PIX_KEY_TYPES = [
  "cpf",
  "cnpj",
  "email",
  "phone",
  "random",
] as const;
export const PixKeyTypeSchema = z.enum(PIX_KEY_TYPES);
export type PixKeyType = z.infer<typeof PixKeyTypeSchema>;

/** Digits only, the way a CNPJ is stored and compared. */
export function normalizeCnpj(value: string): string {
  return value.replace(/\D/g, "");
}

/** Same mod-11 shape as `isValidCpf`, over the CNPJ's own weights. */
export function isValidCnpj(value: string): boolean {
  const digits = normalizeCnpj(value);
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const weightsFor = (length: number) => {
    const weights: number[] = [];
    let weight = length - 7;
    for (let i = 0; i < length; i++) {
      weights.push(weight);
      weight = weight === 2 ? 9 : weight - 1;
    }
    return weights;
  };

  for (const length of [12, 13]) {
    const weights = weightsFor(length);
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += Number(digits[i]) * weights[i];
    }
    const remainder = sum % 11;
    const expected = remainder < 2 ? 0 : 11 - remainder;
    if (expected !== Number(digits[length])) return false;
  }
  return true;
}

const PHONE = /^\+55\d{10,11}$/;
const RANDOM_KEY =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = z.email();

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "").replace(/^55/, "");
  return `+55${digits}`;
}

/**
 * What is stored is what a payload would one day need: digits for CPF/CNPJ,
 * `+55` and digits for phone, lower case for e-mail and for the random key.
 * The mask the citizen or the registrar sees is a screen concern, not a
 * storage one.
 */
export function normalizePixKey(type: PixKeyType, value: string): string {
  switch (type) {
    case "cpf":
      return normalizeCpf(value);
    case "cnpj":
      return normalizeCnpj(value);
    case "phone":
      return normalizePhone(value);
    case "email":
    case "random":
      return value.trim().toLowerCase();
  }
}

export function isValidPixKey(type: PixKeyType, value: string): boolean {
  switch (type) {
    case "cpf":
      return isValidCpf(value);
    case "cnpj":
      return isValidCnpj(value);
    case "email":
      return EMAIL.safeParse(value.trim()).success;
    case "phone":
      return PHONE.test(normalizePhone(value));
    case "random":
      return RANDOM_KEY.test(value.trim());
  }
}
