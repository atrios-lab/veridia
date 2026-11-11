import { reaisInWords } from "../money/extenso.ts";
import type {
  RequerimentoDocument,
  RequerimentoRow,
  RequerimentoSection,
} from "../request/requerimento.ts";
import type { IsoDate } from "../scheduling/calendar.ts";
import { officialName } from "../tenant/identification.ts";
import type { Tenant } from "../tenant/schema.ts";
import { formatMoneyBRL } from "../transparency/bulletin.ts";
import { GUIDE_KIND_INFO, itcdRn } from "./catalog.ts";
import { qualify } from "./qualification.ts";
import {
  formatGuideNumber,
  formatRate,
  type Guide,
  type GuideSettings,
  taxOn,
} from "./schema.ts";

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function writtenDate(date: IsoDate): string {
  return `${Number(date.slice(8, 10))} de ${MONTHS[Number(date.slice(5, 7)) - 1]} de ${date.slice(0, 4)}`;
}

const money = (cents: number) =>
  `R$ ${formatMoneyBRL(cents)} (${reaisInWords(cents)})`;

/** "A, B e C". */
function joinAll(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join("; ")}; e ${items.at(-1)}`;
}

export interface GuideAmount {
  /** Null when the kind carries no tax (a certidão). */
  taxCents: number | null;
  /** How the paper states the rate ("3%", or the RN's brackets). */
  rateLabel: string;
  /** One line per ITCD bracket used, empty for a fixed rate. */
  breakdown: string[];
}

/** What the guia charges, the way the paper prints it. */
export function guideAmount(guide: Guide): GuideAmount {
  const computed = computedAmount(guide);
  // The clerk's own figure wins, on any kind that carries a tax.
  if (computed.taxCents !== null && guide.taxOverrideCents !== null) {
    return { ...computed, taxCents: guide.taxOverrideCents, breakdown: [] };
  }
  return computed;
}

function computedAmount(guide: Guide): GuideAmount {
  const info = GUIDE_KIND_INFO[guide.kind];
  if (info.rate === "none") {
    return { taxCents: null, rateLabel: "", breakdown: [] };
  }
  if (info.rate === "itcd-rn" && !guide.manualRate) {
    const { taxCents, parts } = itcdRn(guide.declaredValueCents);
    return {
      taxCents,
      rateLabel:
        parts.length > 1
          ? "progressiva, por faixa (3% a 6%)"
          : formatRate(parts[0]?.basisPoints ?? 300),
      breakdown: parts.map(
        (part) =>
          `${formatRate(part.basisPoints)} sobre a parcela de R$ ${formatMoneyBRL(part.fromCents)} a R$ ${formatMoneyBRL(part.toCents)}: R$ ${formatMoneyBRL(part.taxCents)}`,
      ),
    };
  }
  return {
    taxCents: taxOn(guide.declaredValueCents, guide.rateBasisPoints),
    rateLabel: formatRate(guide.rateBasisPoints),
    breakdown: [],
  };
}

/** The local law the guia cites, from the office's settings. */
export function localLaw(guide: Guide, settings: GuideSettings): string {
  if (guide.lawText.trim()) return guide.lawText.trim();
  switch (guide.kind) {
    case "itiv":
      return settings.municipal.itivLaw;
    case "laudemio-municipal":
      return settings.municipal.laudemioLaw;
    case "itcd-doacao":
    case "itcd-causa-mortis":
      return settings.state.itcdLaw;
    default:
      return "";
  }
}

/** Who the paper is addressed to. */
export function addressee(guide: Guide, settings: GuideSettings): string {
  if (guide.addresseeText.trim()) return guide.addresseeText.trim();
  const info = GUIDE_KIND_INFO[guide.kind];
  if (info.fisco === "estadual") {
    const name = settings.state.addresseeName.trim();
    return name
      ? `Ao(À) Sr(a). ${name}, ${settings.state.addressee}`
      : `À ${settings.state.addressee}`;
  }
  const cnpj = settings.municipal.cnpj.trim()
    ? ` (CNPJ nº ${settings.municipal.cnpj.trim()})`
    : "";
  return `À ${settings.municipal.addressee} da ${settings.municipal.authority}${cnpj}`;
}

export interface GuideDocumentInput {
  guide: Guide;
  settings: GuideSettings;
  year: number;
  sequence: number;
  /** The date the paper is dated, in the office's calendar. */
  issuedOn: IsoDate;
}

/**
 * The guia as a document on the office's letterhead (the same renderer as
 * every other paper, src/lib/pdf.ts): the addressee, the request with the
 * parties qualified, the property, the values and the law, then the place,
 * the date and who signs, as on the office's own guias.
 */
export function buildGuideDocument(
  tenant: Tenant,
  input: GuideDocumentInput,
): RequerimentoDocument {
  const { guide, settings } = input;
  const info = GUIDE_KIND_INFO[guide.kind];
  const amount = guideAmount(guide);
  const law = localLaw(guide, settings);
  const transmitting = guide.parties.filter((p) => p.role === "transmitente");
  const acquiring = guide.parties.filter((p) => p.role === "adquirente");
  const nature = guide.nature.trim();
  const municipal = info.fisco === "municipal";
  const authority = municipal
    ? settings.municipal.authority
    : "Secretaria de Estado da Tributação do Rio Grande do Norte (SET/RN)";

  // "a qual" for a woman or a company (a pessoa jurídica), "o qual" for a man.
  const first = acquiring[0];
  const who =
    acquiring.length > 1
      ? "os quais pretendem"
      : first?.personType === "fisica" && first.gender === "masculino"
        ? "o qual pretende"
        : "a qual pretende";
  const request =
    info.rate === "none"
      ? `${joinAll(acquiring.concat(transmitting).map(qualify))}, ${acquiring.length + transmitting.length > 1 ? "requerem" : "requer"} a expedição de certidão dos tributos que incidem sobre o imóvel abaixo descrito, para instruir a escritura pública${nature ? ` de ${nature}` : ""} a ser lavrada nesta serventia.`
      : `${joinAll(acquiring.map(qualify))}, ${who} recolher aos cofres da ${authority} o ${info.subject}, à alíquota ${amount.rateLabel.startsWith("progressiva") ? amount.rateLabel : `de ${amount.rateLabel}`} sobre o valor declarado${law ? `, conforme ${law}` : ""}, porquanto ${acquiring.length > 1 ? "dizem" : "diz"} haver ${guide.kind === "itcd-causa-mortis" ? "recebido, por sucessão" : "adquirido"}${nature ? `, por ${nature},` : ""} de ${joinAll(transmitting.map(qualify))}, o imóvel a seguir descrito.`;

  const property: string[] = [
    `${guide.property.type === "rural" ? "IMÓVEL RURAL" : "IMÓVEL URBANO"}: ${guide.property.description.trim()}`,
  ];
  if (guide.property.fiscalRegistration.trim()) {
    property.push(
      `${guide.property.type === "rural" ? "Cadastro (CCIR/CAR/NIRF)" : "Inscrição imobiliária"}: ${guide.property.fiscalRegistration.trim()}.`,
    );
  }
  if (guide.property.registration.trim()) {
    property.push(`Registro: ${guide.property.registration.trim()}.`);
  }

  const values: RequerimentoRow[] = [];
  if (info.rate !== "none" || guide.declaredValueCents > 0) {
    values.push({
      label: "Valor declarado",
      value: money(guide.declaredValueCents),
    });
  }
  if (amount.taxCents !== null) {
    values.push({ label: "Alíquota", value: amount.rateLabel });
    values.push({
      label: "Imposto estimado",
      value: `${money(amount.taxCents)}, sujeito à conferência do fisco`,
    });
  }

  const sections: RequerimentoSection[] = [
    { heading: "Destinatário", paragraphs: [addressee(guide, settings)] },
    { heading: "Requerimento", paragraphs: [request] },
    { heading: "Do imóvel", paragraphs: property },
  ];
  if (values.length) {
    sections.push({
      heading: "Dos valores",
      rows: values,
      paragraphs: amount.breakdown.length ? amount.breakdown : undefined,
    });
  }
  if (guide.notes.trim()) {
    sections.push({ heading: "Observações", paragraphs: [guide.notes.trim()] });
  }
  sections.push({
    heading: "Fundamentação",
    paragraphs: [
      `${[...info.legalBasis, ...(law ? [law] : [])].join("; ")}.`,
      "Lei nº 8.935/1994, art. 30, XI: dever do tabelião de fiscalizar o recolhimento dos impostos incidentes sobre os atos que deve praticar.",
    ],
  });

  const signer = settings.signers[guide.signer] ?? settings.signers[0];
  const number = formatGuideNumber(input.year, input.sequence);
  return {
    eyebrow: `${municipal ? "Fisco municipal" : "Fisco estadual"} · ${info.label}`,
    title: `Guia imobiliária nº ${number}`,
    subtitle: info.subject,
    office: [officialName(tenant), tenant.subtitle],
    sections,
    dateLine: `${tenant.location.city}/${tenant.location.state}, ${writtenDate(input.issuedOn)}.`,
    signee: signer?.name,
    signature: [signer?.title ?? "", signer?.note ?? ""].filter(Boolean),
    footer: `${officialName(tenant)} · Guia imobiliária nº ${number} · ${tenant.legalFooter}`,
  };
}

/** "guia-003-2025-itiv.pdf" */
export function guideFileName(
  year: number,
  sequence: number,
  kind: Guide["kind"],
  extension: "pdf" | "docx",
): string {
  return `guia-${String(sequence).padStart(3, "0")}-${year}-${kind}.${extension}`;
}
