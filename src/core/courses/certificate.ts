import { z } from "zod";
import { formatCpf, isValidCpf, normalizeCpf } from "../request/form.ts";

// The certificate without a database: its code, what the person types to
// get one, how the CPF shows in public and the sentence it carries.

/** Crockford base32 without I, L, O and U: nothing to misread aloud. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * XXXX-XXXX-XXXX from 60 random bits (`bytes` holds at least 8, from
 * `crypto.randomBytes`). Five bits per character, twelve characters.
 */
export function certificateCode(bytes: Uint8Array): string {
  // Bit `b` of the 64 read from the bytes, most significant first.
  const bit = (b: number) => ((bytes[b >> 3] ?? 0) >> (7 - (b & 7))) & 1;
  let out = "";
  for (let i = 0; i < 12; i++) {
    let value = 0;
    for (let j = 0; j < 5; j++) value = (value << 1) | bit(i * 5 + j);
    out += ALPHABET[value];
  }
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}`;
}

const CODE =
  /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

/** A code as typed (any case, with or without hyphens), or null. */
export function normalizeCertificateCode(value: string): string | null {
  const plain = value.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (plain.length !== 12) return null;
  const code = `${plain.slice(0, 4)}-${plain.slice(4, 8)}-${plain.slice(8, 12)}`;
  return CODE.test(code) ? code : null;
}

/** ***.456.789-**: the public check hides the first three and the last two
 * digits, enough to tell two people apart and not enough to reuse. */
export function publicCpf(cpf: string): string {
  const d = normalizeCpf(cpf);
  if (d.length !== 11) return "***.***.***-**";
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

export const certificateRequestSchema = z.object({
  fullName: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .max(120, "O nome passa de 120 caracteres.")
        .refine(
          (value) => value.split(" ").length >= 2,
          "Informe o nome completo.",
        ),
    ),
  cpf: z.string().refine(isValidCpf, "CPF inválido.").transform(normalizeCpf),
  roleTitle: z
    .string()
    .trim()
    .min(2, "Informe a sua função.")
    .max(60, "A função passa de 60 caracteres."),
});

export type CertificateRequest = z.output<typeof certificateRequestSchema>;

/** What a certificate says, as stored at issue. */
export interface CertificateFacts {
  fullName: string;
  cpf: string;
  roleTitle: string;
  tenantName: string;
  courseTitle: string;
  workloadHours: number;
  score: number;
  issuedAt: Date;
}

/**
 * The office a certificate names, outside a cohort: its official name, the
 * one the site shows under the trade name ("Ofício Único de Ielmo Marinho /
 * RN"), not the short `name` of the header and e-mails, which varies from
 * office to office ("Cartório de Taipu", "Tabelionato Aurora"). A cohort
 * learner gets the cohort's office instead (see issueCertificateWith).
 */
export function certificateOfficeName(tenant: { subtitle: string }): string {
  return tenant.subtitle;
}

/** 07/11/2026, in the RN clock every office keeps. */
export function formatCertificateDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Fortaleza",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/** The certificate's sentence, the same on the preview, the PDF and (with
 * the CPF masked) the public check. */
export function certificateSentence(
  facts: CertificateFacts,
  cpf: "full" | "public",
): string {
  const shownCpf = cpf === "full" ? formatCpf(facts.cpf) : publicCpf(facts.cpf);
  const hours =
    facts.workloadHours === 1 ? "1 hora" : `${facts.workloadHours} horas`;
  return (
    `Certificamos que ${facts.fullName}, CPF ${shownCpf}, ${facts.roleTitle} ` +
    `do ${facts.tenantName}, concluiu o curso "${facts.courseTitle}", com ` +
    `carga horária de ${hours} e aproveitamento de ${facts.score}%, em ` +
    `${formatCertificateDate(facts.issuedAt)}.`
  );
}

/**
 * Where a certificate is checked: the Átrios site, which reads it from this
 * platform's API (`/api/certificados/<código>`). Printed on the PDF and in
 * its QR. `CERTIFICATE_CHECK_BASE_URL` overrides it outside production, so
 * a test certificate never points people at the real site.
 */
export const DEFAULT_CERTIFICATE_CHECK_BASE = "https://atrioss.com/certificado";

export function certificateCheckUrl(
  code: string,
  base: string = DEFAULT_CERTIFICATE_CHECK_BASE,
): string {
  return `${base.replace(/\/+$/, "")}/${code}`;
}

/** The origins allowed to read the check API from a browser: the Átrios
 * site, with and without www. */
export const CERTIFICATE_CHECK_ORIGINS: readonly string[] = [
  "https://atrioss.com",
  "https://www.atrioss.com",
];

/** What the check API answers: the public view, CPF masked, never the
 * attempt, the user id or anything else the row holds. */
export interface PublicCertificate {
  valid: true;
  code: string;
  fullName: string;
  cpf: string;
  roleTitle: string;
  tenantName: string;
  courseTitle: string;
  workloadHours: number;
  score: number;
  /** YYYY-MM-DD, in the RN clock. */
  issuedOn: string;
  /** dd/mm/aaaa, ready to print. */
  issuedOnText: string;
  signedBy: string;
}

export function publicCertificate(
  facts: CertificateFacts & { code: string },
): PublicCertificate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(facts.issuedAt);
  return {
    valid: true,
    code: facts.code,
    fullName: facts.fullName,
    cpf: publicCpf(facts.cpf),
    roleTitle: facts.roleTitle,
    tenantName: facts.tenantName,
    courseTitle: facts.courseTitle,
    workloadHours: facts.workloadHours,
    score: facts.score,
    issuedOn: parts,
    issuedOnText: formatCertificateDate(facts.issuedAt),
    signedBy: "Átrios, com certificado digital ICP-Brasil",
  };
}
