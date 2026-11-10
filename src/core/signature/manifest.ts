import type { RequerimentoDocument } from "../request/requerimento.ts";
import { officialName } from "../tenant/identification.ts";
import type { Tenant } from "../tenant/schema.ts";
import { formatOfficeDateTime } from "../time/office-time.ts";
import {
  formatVerificationCode,
  ICP_POLICY,
  maskHolderDocument,
  SIGNATURE_COMPLIANCE_NOTE,
  SIGNATURE_LEGAL_BASIS,
} from "./policy.ts";

/** One signature, as the record keeps it. */
export interface ManifestSignature {
  holderName: string;
  holderDocument: string;
  issuerName: string;
  serialHex: string;
  signedAt: Date;
}

export interface ManifestInput {
  code: string;
  title: string;
  originalName: string;
  pageCount: number;
  originalSha256: string;
  /** The latest signed file's hash; absent before the first signature. */
  currentSha256?: string;
  signatures: ManifestSignature[];
  verifyUrl: string;
}

/**
 * The "Manifesto de assinaturas": the paper that says who signed what,
 * when and with which certificate, as courts and notaries print it after a
 * digital signature. Drawn with the office's letterhead by `renderDocument`,
 * the QR leading to the verification page.
 */
export function buildSignatureManifest(
  tenant: Tenant,
  input: ManifestInput,
): RequerimentoDocument {
  const code = formatVerificationCode(input.code);
  const documentRows = [
    { label: "Título", value: input.title },
    { label: "Arquivo original", value: input.originalName },
    {
      label: "Páginas do original",
      value: String(input.pageCount),
    },
    { label: "SHA-256 do original", value: input.originalSha256 },
    ...(input.currentSha256
      ? [{ label: "SHA-256 do arquivo assinado", value: input.currentSha256 }]
      : []),
  ];
  const signatures = input.signatures.map((signature, index) => ({
    heading: `Assinatura ${index + 1}`,
    rows: [
      { label: "Assinante", value: signature.holderName },
      ...(signature.holderDocument
        ? [
            {
              label: signature.holderDocument.length === 14 ? "CNPJ" : "CPF",
              value: maskHolderDocument(signature.holderDocument),
            },
          ]
        : []),
      {
        label: "Data e hora",
        value: `${formatOfficeDateTime(signature.signedAt)} (horário de Brasília)`,
      },
      { label: "Certificado emitido por", value: signature.issuerName },
      { label: "Número de série", value: signature.serialHex.toUpperCase() },
      {
        label: "Política de assinatura",
        value: `${ICP_POLICY.label}, OID ${ICP_POLICY.oid}`,
      },
    ],
  }));
  return {
    eyebrow: "Assinador digital",
    title: "Manifesto de assinaturas",
    subtitle: `Código de verificação ${code}`,
    office: [officialName(tenant), tenant.subtitle],
    sections: [
      { heading: "Documento", rows: documentRows },
      ...signatures,
      {
        heading: "Validade e verificação",
        paragraphs: [
          `As assinaturas acima foram feitas com certificado digital ICP-Brasil, no padrão PAdES, e têm a validade jurídica da assinatura qualificada (${SIGNATURE_LEGAL_BASIS}).`,
          `Para conferir, leia o QR Code no alto desta folha, acesse ${input.verifyUrl.replace(/^https?:\/\//, "")} e informe o código ${code}, ou envie o PDF assinado ao validador oficial do ITI (validar.iti.gov.br).`,
          SIGNATURE_COMPLIANCE_NOTE,
        ],
      },
    ],
    signature: [],
    footer: `${officialName(tenant)} · Manifesto de assinaturas · ${code} · ${tenant.legalFooter}`,
  };
}
