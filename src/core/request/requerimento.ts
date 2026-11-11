import type { Act } from "../acts/catalog.ts";
import { actVariantName, PURPOSE_LABEL } from "../acts/catalog.ts";
import { formatMoney } from "../fees/prenotation.ts";
import {
  officeWithJurisdiction,
  officialName,
} from "../tenant/identification.ts";
import type { Tenant } from "../tenant/schema.ts";
import { formatOfficeDate } from "../time/office-time.ts";
import type { SignedFormDocument } from "./attachment.ts";
import { dataRightOption, dataRightsDeadlineIsLegal } from "./channels.ts";
import {
  ALTERNATE_DOCUMENT_LABELS,
  type AlternateDocument,
  asksRequesterQualification,
  type DataRight,
  type DeliveryFormat,
  deliveryFormatRows,
  type PrenotationCharge,
  type RequesterQualification,
  requesterQualificationRows,
} from "./kinds.ts";
import {
  citeLegalBasis,
  generalGrounds,
  SPECIALTIES,
} from "./legal-grounds.ts";

/**
 * The signed form, as content. Building it here, with no PDF library in sight,
 * is what lets the wording be read and tested: the drawing code downstream
 * only places what this returns.
 */
/**
 * Said wherever the citizen is told they may print and sign by hand. Only the
 * digital signature (Gov.br ou e-Notariado) dispenses with recognizing the
 * signature: whoever signs on paper still has to take it to a cartório, and
 * discovering that at the counter is a wasted trip.
 */
export const HANDWRITTEN_SIGNATURE_CAVEAT =
  "Se assinar de próprio punho, reconheça a firma no cartório mais próximo. " +
  "A dispensa de reconhecimento vale só para a assinatura digital (Gov.br ou e-Notariado).";

/** O aviso de assinatura que vale para este ato. */
export function signatureCaveatFor(act: Pick<Act, "signatureCaveat">): string {
  return act.signatureCaveat ?? HANDWRITTEN_SIGNATURE_CAVEAT;
}

/**
 * The pedido is registered without the signed requerimento, but the office
 * does not move it until the document arrives. Said on every screen that asks
 * for it, so no screen reads as if the citizen were already done.
 */
export const SIGNED_FORM_REQUIRED_NOTICE =
  "Sem o requerimento assinado, a serventia não dá andamento ao pedido.";

/** The counter is still a way in, with the same condition attached. */
export const SIGNED_FORM_COUNTER_OPTION =
  "Se preferir, entregue o requerimento assinado em papel no balcão. Sem ele, o pedido não tramita.";

export const SIGNED_FORM_CONFIRMATIONS: Record<SignedFormDocument, string> = {
  requerimento:
    "Confirmo que este arquivo é o requerimento deste pedido, já assinado.",
  declaracao:
    "Confirmo que este arquivo é a declaração de hipossuficiência deste pedido, já assinada.",
};

export const SIGNED_FORM_WRONG_DOCUMENT_WARNING =
  "Se for outro documento, o pedido não tramita na serventia.";

export interface RequerimentoRow {
  label: string;
  value: string;
}

/**
 * A labelled field the person signing fills by hand: a small caption, then
 * either the value already known (`value` present, printed on the line) or a
 * blank rule for the paper to carry (`value` absent). This is what a form
 * needs and a `RequerimentoRow` does not: `declaracao.ts` uses it for every
 * Anexo I field the pedido may or may not have collected, so the same
 * drawing code renders both the filled declaração and the blank one.
 */
export interface RequerimentoField {
  label: string;
  value?: string;
}

export interface RequerimentoSection {
  heading: string;
  rows?: RequerimentoRow[];
  /** Rendered as a form, one label-and-line per field, in order: see
   * `RequerimentoField`. */
  fields?: RequerimentoField[];
  paragraphs?: string[];
  /** A spreadsheet-like table, after the paragraphs: the papel de
   * segurança's demonstrativo and its numbering (decision of 11/11/2026). */
  table?: RequerimentoTable;
  /** A paragraph set apart in a tinted box, after the others: the point a
   * reader must not miss. */
  highlight?: string;
}

/**
 * A table drawn in the document's own type: a tinted header row repeated
 * on every page it runs onto, thin rules between rows, an optional bold
 * total. `weight` shares the width (1 by default).
 */
export interface RequerimentoTable {
  columns: { label: string; weight?: number; align?: "left" | "right" }[];
  rows: string[][];
  total?: string[];
  /** Said in place of the rows when there are none. */
  empty?: string;
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
  /** Absent means "requerimento": the discriminant `renderDocuments`
   * (`src/lib/pdf.ts`) uses to tell this document apart from a
   * `DeclaracaoDocument` (`src/core/request/declaracao.ts`) in the array it
   * draws. Never set explicitly by the builders below; only the union type
   * needs it named. */
  kind?: "requerimento";
  /** Small letterspaced line above the title ("Solicitação de atos"). */
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
  /**
   * "Ielmo Marinho/RN, 9 de novembro de 2026.": the place and date the paper
   * is dated, drawn centred after the last section, above the signature.
   */
  dateLine?: string;
  signee?: string;
  signature: string[];
  footer: string;
  credentials?: RequerimentoCredentials;
  /**
   * A page of a book with numbered sheets (Livro Diário Auxiliar, CN art.
   * 186): each page of this document prints "<label> <n>" at the top,
   * counting from `first`.
   */
  sheet?: { first: number; label: string };
}

export interface RequerimentoData {
  protocolNumber: string;
  // No access key here on purpose: this document is signed and sent back, so
  // the credential never enters it. It rides in `buildAccessReceipt` instead.
  applicantName: string;
  contact: string;
  /** Asked for apart from the contact on the public form; often absent. */
  phone?: string | null;
  /**
   * The exemption the citizen asked for, absent when they did not. `actId` is
   * the act the exemption is for, and it is absent in the requests filed
   * before the gratuidade became an act of its own: the declaration still
   * prints, without a fundamento it cannot name.
   */
  exemption?: { actId?: string };
  /** The kind of act chosen (`details.actVariant`), when the act has kinds. */
  actVariant?: string;
  /** Quem pede o inteiro teor do RCPN (`details.requesterQualification`). */
  requesterQualification?: RequesterQualification;
  /** Digital ou papel (`details.deliveryFormat`), nos atos que deixam escolher. */
  deliveryFormat?: DeliveryFormat;
  /** A prenotação cobrada no pedido, com o código e a tabela de onde veio. */
  prenotation?: PrenotationCharge;
  cpf?: string | null;
  /** Stands in for the CPF of a citizen who has none (`details`). */
  alternateDocument?: AlternateDocument;
  description?: string | null;
  purpose?: string | null;
  parameterValue?: string | null;
  createdAt: Date;
}

function formatCpf(digits: string): string {
  return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

/** "Lido o requerimento como um todo": quem pede, com o documento que tiver. */
function qualificationOf(data: RequerimentoData): string {
  const document = data.cpf
    ? `, inscrito(a) no CPF sob o n. ${formatCpf(data.cpf)}`
    : data.alternateDocument
      ? `, portador(a) do documento ${ALTERNATE_DOCUMENT_LABELS[data.alternateDocument.type]} n. ${data.alternateDocument.number}`
      : "";
  return `${data.applicantName}${document}, com contato por ${data.contact}`;
}

/**
 * O requerimento do ato, como peça: dirigido ao oficial ou tabelião da
 * especialidade, com a qualificação do requerente, o pedido formal, o que a
 * especialidade faz e com que fundamento, o princípio da instância (a
 * serventia é inerte e só age provocada), os fatos nas palavras do próprio
 * requerente, a fundamentação legal do ato, os documentos, as declarações e
 * o fecho. Vale para qualquer ato do catálogo, em qualquer especialidade.
 */
export function buildRequerimento(
  tenant: Tenant,
  act: Act,
  data: RequerimentoData,
): RequerimentoDocument {
  const specialty = SPECIALTIES[act.attribution];
  const actName = actVariantName(act, data.actVariant) ?? act.name;
  // A gratuidade é um pedido sobre outro ato: é esse ato que se requer, com
  // o seu fundamento, e a gratuidade vai junto.
  const target = data.exemption?.actId
    ? act.exemptionTargets?.find((t) => t.id === data.exemption?.actId)
    : undefined;
  const requested = target
    ? {
        name: actVariantName(target, data.actVariant) ?? target.name,
        basis: citeLegalBasis(target.legalBasis),
      }
    : { name: actName, basis: citeLegalBasis(act.legalBasis) };

  const applicant: RequerimentoRow[] = [
    { label: "Nome", value: data.applicantName },
  ];
  if (data.cpf) applicant.push({ label: "CPF", value: formatCpf(data.cpf) });
  if (data.alternateDocument) {
    applicant.push({
      label: ALTERNATE_DOCUMENT_LABELS[data.alternateDocument.type],
      value: data.alternateDocument.number,
    });
  }
  applicant.push({ label: "Contato", value: data.contact });
  if (data.phone) applicant.push({ label: "Telefone", value: data.phone });

  // Protocol and date live in the subtitle, not here: they identify the
  // document and read best right under the title. The access key is the
  // credential and goes on its own page below, never in the body.
  const request: RequerimentoRow[] = [
    { label: "Especialidade", value: specialty.name },
    { label: "Ato requerido", value: actName },
    { label: "Fundamento do ato", value: requested.basis },
  ];
  if (act.deliveryChoice) {
    request.push(...deliveryFormatRows(data.deliveryFormat));
  }
  if (data.purpose) request.push({ label: PURPOSE_LABEL, value: data.purpose });
  if (
    data.requesterQualification &&
    asksRequesterQualification(act, data.actVariant)
  ) {
    request.push(...requesterQualificationRows(data.requesterQualification));
  }
  if (data.parameterValue) {
    request.push({ label: "Informação adicional", value: data.parameterValue });
  }
  // The value charged and where it comes from, so the signed paper says it is
  // the prenotação (not the registration) and which table priced it.
  if (data.prenotation) {
    request.push({
      label: "Prenotação",
      value: `${formatMoney(data.prenotation.totalCents)} · código ${data.prenotation.code} (${data.prenotation.description}) da ${data.prenotation.tableTitle}`,
    });
  }

  const sections: RequerimentoSection[] = [
    {
      heading: "Destinatário",
      paragraphs: [
        `Ilustríssimo(a) Senhor(a) ${specialty.officer} do ${officeWithJurisdiction(tenant)}.`,
      ],
    },
    { heading: "Qualificação do requerente", rows: applicant },
    {
      heading: "Do requerimento",
      paragraphs: [
        `${qualificationOf(data)}, vem, respeitosamente, à presença de Vossa Senhoria, com ` +
          `fundamento no ${specialty.instanceBasis}, REQUERER a prática do ato de ` +
          `"${requested.name}"${target ? ", com gratuidade" : ""}, da especialidade de ` +
          `${specialty.name}, pelos fatos e fundamentos a seguir expostos.`,
      ],
    },
    { heading: "Do ato requerido", rows: request },
    { heading: "Da especialidade", paragraphs: [specialty.scope] },
    {
      heading: "Do princípio da instância",
      paragraphs: [specialty.instance],
    },
  ];

  // What the citizen wrote is theirs: quoted as written, never rephrased.
  if (data.description) {
    sections.push({
      heading: "Dos fatos, nas palavras do requerente",
      paragraphs: [`“${data.description.trim()}”`],
    });
  }

  sections.push({
    heading: "Da fundamentação legal",
    paragraphs: [
      `Fundamento do ato requerido: ${requested.basis}. Observam-se, ainda, as normas ` +
        "da especialidade e as gerais dos serviços notariais e de registro:",
      ...[...specialty.grounds, ...generalGrounds(tenant.location.state)].map(
        (ground) => `- ${ground}`,
      ),
    ],
  });

  if (act.documents?.length) {
    sections.push({
      heading: "Documentos que instruem o pedido",
      paragraphs: act.documents.map((document) => `- ${document}`),
    });
  }

  if (act.guidance) {
    sections.push({ heading: "Orientação", paragraphs: [act.guidance] });
  }

  const declarations = [
    "Autorizo o tratamento dos meus dados pessoais para a análise e a " +
      "prática do ato requerido, nos termos da Lei 13.709/2018 (LGPD).",
    "Declaro, sob as penas da lei, que as informações prestadas neste " +
      "requerimento são verdadeiras.",
  ];
  if (data.exemption) {
    const requested = act.exemptionTargets?.find(
      (target) => target.id === data.exemption?.actId,
    );
    // O texto do Anexo I e as cinco ciências vivem só na declaração de
    // hipossuficiência (declaracao.ts), documento próprio que acompanha este
    // requerimento (Provimento CGJ/TJRN n. 7/2026, art. 13): repeti-los aqui
    // duplicaria o que a pessoa já assina no outro papel.
    declarations.push(
      requested?.feeExemption
        ? `Pede a gratuidade de "${actVariantName(requested, data.actVariant) ?? requested.name}" (fundamento: ` +
            `${citeLegalBasis(requested.feeExemption.legalBasis)}), conforme declaração de ` +
            "hipossuficiência que acompanha este requerimento."
        : "Pede a gratuidade conforme declaração de hipossuficiência que " +
            "acompanha este requerimento.",
    );
  }
  sections.push({ heading: "Declarações", paragraphs: declarations });

  sections.push({
    heading: "Do pedido",
    paragraphs: [
      "Diante do exposto, requer a Vossa Senhoria o recebimento e o processamento deste " +
        `requerimento, com a prática do ato de "${requested.name}" após a ${specialty.qualification}, ` +
        (data.exemption
          ? "apreciado o pedido de gratuidade; não reconhecida a gratuidade, mediante o " +
            "recolhimento dos emolumentos devidos pela tabela vigente. "
          : "mediante o recolhimento dos emolumentos devidos pela tabela vigente. ") +
        "Havendo exigência a cumprir, requer seja formulada por escrito, de uma só vez, para " +
        "que o requerente possa atendê-la.",
      "Termos em que pede deferimento.",
    ],
  });
  const dateLine = `${tenant.location.city}/${tenant.location.state}, ${formatOfficeDate(data.createdAt)}.`;

  return {
    eyebrow: specialty.name,
    title: "Requerimento",
    subtitle: `Protocolo ${data.protocolNumber} · ${formatOfficeDate(data.createdAt)}`,
    office: [
      officialName(tenant),
      tenant.subtitle,
      `${tenant.contacts.phone} · ${tenant.contacts.email}`,
    ],
    sections,
    dateLine,
    signee: data.applicantName,
    signature: [
      "Assine este requerimento pelo Gov.br (assinador.iti.br) ou imprima e " +
        "assine de próprio punho. Depois, envie o arquivo assinado pela " +
        "consulta do protocolo ou entregue o papel no balcão da serventia.",
      signatureCaveatFor(act),
    ],
    footer: `${officialName(tenant)} · Protocolo ${data.protocolNumber} · ${tenant.legalFooter}`,
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
    eyebrow: "Solicitação de atos",
    title: "Comprovante de acesso",
    subtitle: `Protocolo ${data.protocolNumber} · ${formatOfficeDate(data.createdAt)}`,
    office: [
      officialName(tenant),
      tenant.subtitle,
      `${tenant.contacts.phone} · ${tenant.contacts.email}`,
    ],
    // No sections and no signee: there is nothing to sign on a receipt.
    sections: [],
    signature: [],
    footer: `${officialName(tenant)} · Protocolo ${data.protocolNumber} · ${tenant.legalFooter}`,
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
    subtitle: `Protocolo ${data.protocolNumber} · ${formatOfficeDate(data.createdAt)}`,
    office: [
      officialName(tenant),
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
          // The statute fixes the fifteen days only for access (art. 19, II);
          // for the other rights they are the office's own rule, and the
          // receipt must not dress them up as law.
          dataRightsDeadlineIsLegal(data.right)
            ? {
                label: "Prazo legal para resposta",
                value: `${data.deadline} (15 dias, Lei 13.709/2018, art. 19, II)`,
              }
            : {
                label: "Prazo de resposta",
                value: `${data.deadline} (15 dias, prazo da serventia)`,
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
    footer: `${officialName(tenant)} · Protocolo ${data.protocolNumber} · ${tenant.legalFooter}`,
  };
}
