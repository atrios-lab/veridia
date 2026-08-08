import type { Act } from "../acts/catalog.ts";
import { ATTRIBUTION_NAMES } from "../acts/catalog.ts";
import type { Tenant } from "../tenant/schema.ts";
import { dataRightOption } from "./channels.ts";
import type { DataRight } from "./kinds.ts";

/**
 * The signed form, as content. Building it here, with no PDF library in sight,
 * is what lets the wording be read and tested: the drawing code downstream
 * only places what this returns.
 */
export interface RequerimentoRow {
  label: string;
  value: string;
}

export interface RequerimentoSection {
  heading: string;
  rows?: RequerimentoRow[];
  paragraphs?: string[];
}

export interface RequerimentoDocument {
  title: string;
  office: string[];
  sections: RequerimentoSection[];
  signature: string[];
  footer: string;
}

export interface RequerimentoData {
  protocolNumber: string;
  /** Printed on the form so losing the screen does not lose the key. */
  accessKey: string;
  applicantName: string;
  contact: string;
  cpf?: string | null;
  description?: string | null;
  purpose?: string | null;
  parameterValue?: string | null;
  createdAt: Date;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatCpf(digits: string): string {
  return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

export function buildRequerimento(
  tenant: Tenant,
  act: Act,
  data: RequerimentoData,
): RequerimentoDocument {
  const applicant: RequerimentoRow[] = [
    { label: "Nome", value: data.applicantName },
    { label: "Contato", value: data.contact },
  ];
  if (data.cpf) applicant.push({ label: "CPF", value: formatCpf(data.cpf) });

  const request: RequerimentoRow[] = [
    { label: "Protocolo", value: data.protocolNumber },
    { label: "Chave de acesso", value: data.accessKey },
    { label: "Atribuição", value: ATTRIBUTION_NAMES[act.attribution] },
    { label: "Ato requerido", value: act.name },
    { label: "Base legal", value: act.legalBasis },
    { label: "Data do pedido", value: formatDate(data.createdAt) },
  ];
  if (data.purpose) request.push({ label: "Finalidade", value: data.purpose });
  if (data.parameterValue) {
    request.push({ label: "Informação adicional", value: data.parameterValue });
  }

  const sections: RequerimentoSection[] = [
    { heading: "Requerente", rows: applicant },
    { heading: "Pedido", rows: request },
  ];

  if (data.description) {
    sections.push({
      heading: "Descrição do pedido",
      paragraphs: [data.description],
    });
  }

  if (act.documents?.length) {
    sections.push({
      heading: "Documentos esperados para este ato",
      paragraphs: act.documents.map((document) => `- ${document}`),
    });
  }

  if (act.guidance) {
    sections.push({ heading: "Orientação", paragraphs: [act.guidance] });
  }

  sections.push({
    heading: "Declarações",
    paragraphs: [
      "Autorizo o tratamento dos meus dados pessoais para a análise e a " +
        "prática do ato requerido, nos termos da Lei 13.709/2018 (LGPD).",
      "Declaro, sob as penas da lei, que as informações prestadas neste " +
        "requerimento são verdadeiras.",
    ],
  });

  return {
    title: "Requerimento de serviço",
    office: [
      tenant.name,
      tenant.subtitle,
      `CNS ${tenant.cns}`,
      `${tenant.contacts.phone} · ${tenant.contacts.email}`,
    ],
    sections,
    signature: [
      "Assine este requerimento digitalmente pelo Gov.br (assinador.iti.br) " +
        "ou de próprio punho, e envie o arquivo assinado pela consulta do " +
        "protocolo ou entregue no balcão.",
      "",
      "___________________________________________",
      data.applicantName,
    ],
    footer: `${tenant.name} · Protocolo ${data.protocolNumber} · ${tenant.legalFooter}`,
  };
}

export interface DataRightsReceiptData {
  protocolNumber: string;
  accessKey: string;
  applicantName: string;
  email: string;
  cpf?: string | null;
  right: DataRight;
  description: string;
  createdAt: Date;
  deadline: string;
}

/**
 * The receipt of a data subject's requirement. It is not a form to sign: it is
 * proof of what was asked, when, and by when the office has to answer, which
 * is what the holder needs if the term goes by unanswered.
 */
export function buildDataRightsReceipt(
  tenant: Tenant,
  data: DataRightsReceiptData,
): RequerimentoDocument {
  const option = dataRightOption(data.right);
  const holder: RequerimentoRow[] = [
    { label: "Nome", value: data.applicantName },
    { label: "E-mail", value: data.email },
  ];
  if (data.cpf) holder.push({ label: "CPF", value: formatCpf(data.cpf) });

  return {
    title: "Recibo de requerimento ao Encarregado de Dados",
    office: [
      tenant.name,
      tenant.subtitle,
      `CNS ${tenant.cns}`,
      `Encarregado: ${tenant.dpo.name} · ${tenant.dpo.email}`,
    ],
    sections: [
      { heading: "Titular", rows: holder },
      {
        heading: "Requerimento",
        rows: [
          { label: "Protocolo", value: data.protocolNumber },
          { label: "Chave de acesso", value: data.accessKey },
          { label: "Direito exercido", value: option.legalName },
          { label: "Pedido do titular", value: option.label },
          { label: "Data do pedido", value: formatDate(data.createdAt) },
          {
            label: "Prazo legal para resposta",
            value: `${data.deadline} (15 dias, Lei 13.709/2018)`,
          },
        ],
      },
      { heading: "Descrição do pedido", paragraphs: [data.description] },
      {
        heading: "Declarações",
        paragraphs: [
          "O titular declarou ser o titular dos dados pessoais ou seu " +
            "representante legal.",
          "A resposta do Encarregado fica disponível na consulta do protocolo, " +
            "protegida pela chave de acesso acima. Se houver dúvida sobre a " +
            "titularidade, o Encarregado pode pedir comprovação pela própria " +
            "consulta.",
        ],
      },
    ],
    signature: [
      "Este recibo comprova o registro do requerimento. Guarde a chave de " +
        "acesso: é com ela que a resposta é lida.",
    ],
    footer: `${tenant.name} · Protocolo ${data.protocolNumber} · ${tenant.legalFooter}`,
  };
}
