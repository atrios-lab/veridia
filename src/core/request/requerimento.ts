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

/**
 * The protocol and the access key, highlighted as a card. Only the access
 * receipt carries this: it is a document of its own precisely so the
 * requerimento, which gets signed and sent back, never holds the credential.
 */
export interface RequerimentoCredentials {
  heading: string;
  rows: RequerimentoRow[];
  note: string;
}

export interface RequerimentoDocument {
  /** Small letterspaced line above the title ("Serviços on-line"). */
  eyebrow: string;
  title: string;
  /** Protocol and date, right under the title, where the eye lands first. */
  subtitle: string;
  office: string[];
  sections: RequerimentoSection[];
  /**
   * Who signs, when someone does. Present, the renderer leaves blank space to
   * sign by hand, draws the rule and prints this name under it. Absent (the
   * receipt), there is no signing and no space is wasted pretending there is.
   */
  signee?: string;
  signature: string[];
  footer: string;
  credentials?: RequerimentoCredentials;
}

export interface RequerimentoData {
  protocolNumber: string;
  // No access key here on purpose: this document is signed and sent back, so
  // the credential never enters it. It rides in `buildAccessReceipt` instead.
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

  // Protocol and date live in the subtitle, not here: they identify the
  // document and read best right under the title. The access key is the
  // credential and goes on its own page below, never in the body.
  const request: RequerimentoRow[] = [
    { label: "Atribuição", value: ATTRIBUTION_NAMES[act.attribution] },
    { label: "Ato requerido", value: act.name },
    { label: "Base legal", value: act.legalBasis },
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
    eyebrow: "Serviços on-line",
    title: "Requerimento de serviço",
    subtitle: `Protocolo ${data.protocolNumber} · ${formatDate(data.createdAt)}`,
    office: [
      tenant.name,
      tenant.subtitle,
      `${tenant.contacts.phone} · ${tenant.contacts.email}`,
    ],
    sections,
    signee: data.applicantName,
    signature: [
      "Assine este requerimento pelo Gov.br (assinador.iti.br) ou imprima e " +
        "assine de próprio punho. Depois, envie o arquivo assinado pela " +
        "consulta do protocolo ou entregue o papel no balcão da serventia.",
    ],
    footer: `${tenant.name} · Protocolo ${data.protocolNumber} · ${tenant.legalFooter}`,
  };
}

export interface AccessReceiptData {
  protocolNumber: string;
  accessKey: string;
  createdAt: Date;
}

/**
 * The access credential, as a file of its own. It is deliberately not part of
 * the requerimento: signing at Gov.br signs the whole PDF, and that signed PDF
 * is what comes back to the office through the site. A page the citizen was
 * told to detach only protects whoever prints; a separate file protects
 * everyone.
 */
export function buildAccessReceipt(
  tenant: Tenant,
  data: AccessReceiptData,
): RequerimentoDocument {
  return {
    eyebrow: "Serviços on-line",
    title: "Comprovante de acesso",
    subtitle: `Protocolo ${data.protocolNumber} · ${formatDate(data.createdAt)}`,
    office: [
      tenant.name,
      tenant.subtitle,
      `${tenant.contacts.phone} · ${tenant.contacts.email}`,
    ],
    // No sections and no signee: there is nothing to sign on a receipt.
    sections: [],
    signature: [],
    footer: `${tenant.name} · Protocolo ${data.protocolNumber} · ${tenant.legalFooter}`,
    credentials: {
      heading: "Guarde estes dados",
      rows: [
        { label: "Protocolo", value: data.protocolNumber },
        { label: "Chave de acesso", value: data.accessKey },
      ],
      note:
        "É com o protocolo e a chave acima que você acompanha o pedido e lê " +
        "a resposta da serventia, na consulta de protocolo do site. O site " +
        "não mostra a chave de novo; se perder, peça outra à serventia. " +
        "Guarde este arquivo só para você: ele não faz parte do " +
        "requerimento e não deve ser enviado junto com o requerimento " +
        "assinado.",
    },
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
 *
 * Which is why it carries no `credentials` block: nobody signs this and sends
 * it back, so there is no sheet to detach the key from. It stays in the body,
 * where the holder reads it.
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
    eyebrow: "Encarregado de Dados · LGPD",
    title: "Recibo do requerimento",
    subtitle: `Protocolo ${data.protocolNumber} · ${formatDate(data.createdAt)}`,
    office: [
      tenant.name,
      tenant.subtitle,
      `Encarregado: ${tenant.dpo.name} · ${tenant.dpo.email}`,
    ],
    sections: [
      { heading: "Titular", rows: holder },
      {
        heading: "Requerimento",
        rows: [
          // The key stays in the body here: nobody signs a receipt and sends
          // it back, so there is no sheet to detach it from.
          { label: "Chave de acesso", value: data.accessKey },
          { label: "Direito exercido", value: option.legalName },
          { label: "Pedido do titular", value: option.label },
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
          "Quem enviou este requerimento declarou ser o titular dos dados " +
            "pessoais ou seu representante legal.",
          "A resposta do Encarregado fica disponível na consulta do protocolo, " +
            "protegida pela chave de acesso acima. Se houver dúvida sobre a " +
            "titularidade, o Encarregado pode pedir comprovação pela própria " +
            "consulta.",
        ],
      },
    ],
    signature: [
      "Este recibo comprova o registro do requerimento. Guarde a chave de " +
        "acesso: é com ela que você lê a resposta na consulta do protocolo.",
    ],
    footer: `${tenant.name} · Protocolo ${data.protocolNumber} · ${tenant.legalFooter}`,
  };
}
