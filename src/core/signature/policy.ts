/**
 * The ICP-Brasil signature policy every signature of the platform declares:
 * PAdES AD-RB v1.1 ("referência básica"), from the ITI's official list of
 * PAdES policies (LPA_PAdES.der, read on 10/11/2026 at
 * politicas.icpbrasil.gov.br, valid until 02/03/2029). The hash is the
 * SHA-256 of the policy file itself (PA_PAdES_AD_RB_v1_1.der), checked
 * against the list. The policy asks for four signed attributes and no
 * signing-time attribute (the time goes in the PDF's /M): contentType,
 * messageDigest, signingCertificateV2 and sigPolicyId.
 */
export const ICP_POLICY = {
  name: "PA_PAdES_AD_RB_v1_1",
  label: "PAdES AD-RB v1.1 (ICP-Brasil)",
  oid: "2.16.76.1.7.1.11.1.1",
  uri: "http://politicas.icpbrasil.gov.br/PA_PAdES_AD_RB_v1_1.der",
  sha256Hex: "95752d26ca974d46675ae7fb787b606a71ea941f26b59f6b6a321f97d63b9cb1",
} as const;

/** The legal basis printed on the documents, each one checked in the law. */
export const SIGNATURE_LEGAL_BASIS =
  "MP nº 2.200-2/2001, art. 10, § 1º, e Lei nº 14.063/2020, art. 4º, III";

/**
 * What authorizes the office to use the platform, as the site's footer
 * states it, and the data protection law.
 */
export const SIGNATURE_COMPLIANCE_NOTE =
  'Assinado na Plataforma Eletrônica Oficial da Serventia, nos termos do art. 208, II, "b", do Código Nacional de Normas do CNJ (Provimento CNJ nº 180/2024). Dados tratados conforme a LGPD (Lei nº 13.709/2018).';

/** "AB12-CD34-EF56": what the QR and the verification page carry. */
export function formatVerificationCode(raw: string): string {
  const clean = raw.replace(/[^0-9A-Z]/gi, "").toUpperCase();
  return clean.match(/.{1,4}/g)?.join("-") ?? "";
}

/** What a person types back: lower case, spaces, missing dashes. */
export function normalizeVerificationCode(value: string): string {
  return formatVerificationCode(value.trim());
}

/** "***.456.789-**" for a CPF, the CNPJ in full (a company is public). */
export function maskHolderDocument(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length === 11) return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
  if (d.length === 14) {
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  return "";
}
