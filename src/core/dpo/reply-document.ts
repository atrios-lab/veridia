import type { DataRight } from "../request/kinds.ts";
import type { RequerimentoDocument } from "../request/requerimento.ts";
import { writtenDate } from "../scheduling/attendance.ts";
import { officialName } from "../tenant/identification.ts";
import type { Tenant } from "../tenant/schema.ts";

/**
 * The answer to the titular's requerimento as a document (decision of
 * 15/11/2026: "o rascunho em documento para ele analisar e já emitir e
 * assinar físico ou digital"): the text the encarregado reviewed, under
 * the office's letterhead, with the requerimento identified, to sign
 * digitally or print and sign by hand.
 */
export const RIGHT_TITLES: Record<DataRight, string> = {
  access: "Acesso aos dados pessoais",
  rectification: "Correção de dados pessoais",
  deletion: "Eliminação de dados pessoais",
  other: "Outro direito do titular",
};

export interface ReplyDocumentInput {
  protocol: string;
  applicantName: string | null;
  right: DataRight;
  /** ISO day the requerimento came in. */
  requestedOn: string;
  /** The answer, as reviewed; paragraphs split by blank lines. */
  text: string;
  /** ISO day the answer is dated. */
  issuedOn: string;
}

const isoDate = (iso: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
    : "";

export function buildDataRightsReply(
  tenant: Tenant,
  input: ReplyDocumentInput,
): RequerimentoDocument {
  const paragraphs = input.text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
  return {
    eyebrow: "Lei Geral de Proteção de Dados Pessoais",
    title: "Resposta ao requerimento do titular",
    subtitle: `Protocolo ${input.protocol} · ${RIGHT_TITLES[input.right]}`,
    office: [officialName(tenant), tenant.subtitle],
    sections: [
      {
        heading: "Requerimento",
        rows: [
          { label: "Protocolo", value: input.protocol },
          { label: "Titular", value: input.applicantName ?? "Não informado" },
          { label: "Direito pedido", value: RIGHT_TITLES[input.right] },
          { label: "Recebido em", value: isoDate(input.requestedOn) },
        ],
      },
      {
        heading: "Resposta",
        paragraphs: paragraphs.length ? paragraphs : ["(Sem texto.)"],
      },
    ],
    dateLine: `${tenant.location.city}/${tenant.location.state}, ${writtenDate(input.issuedOn)}.`,
    signee: tenant.dpo.name || tenant.holderName || officialName(tenant),
    signature: ["Encarregado(a) pelo tratamento de dados pessoais"],
    footer: `${officialName(tenant)} · Resposta ao titular · Protocolo ${input.protocol} · ${tenant.legalFooter}`,
  };
}
