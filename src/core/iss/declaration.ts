import { z } from "zod";
import { reaisInWords } from "@/core/money/extenso.ts";
import type {
  RequerimentoDocument,
  RequerimentoSection,
} from "@/core/request/requerimento.ts";
import { holderName, officialName } from "@/core/tenant/identification.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { formatMoneyBRL } from "@/core/transparency/bulletin.ts";
import { FUNDS_BY_STATE } from "@/core/transparency/rubrics.ts";

/**
 * Declaração de ISS (decision of 11/11/2026): the office tells the
 * municipal tax office, month by month, the ISS on its emolumentos, so the
 * holder does not write an ofício every month to a prefeitura with no
 * online system. The figures come from the Livro Diário Auxiliar da
 * Receita e da Despesa, whose copy for the month goes attached and is
 * ratified by the declaration; the services are therefore not itemised.
 *
 * What the ISS is charged on: the price of the service, which for a
 * notary or registry is the emolumentos (LC 116/2003, art. 7º; STJ, 1ª
 * Seção, REsp 1.328.384/RS). Not the gross intake: the parcels passed on
 * to the State and its funds (FDJ, FRMP, FCRCPN, FUNAF in RN) are other
 * taxes, of other creditors.
 *
 * The ISS itself may come worked out act by act from the system's
 * "Valores Tributários" report (decision of 11/11/2026): some acts carry no
 * ISS (a certidão without the PGE parcel, a free act), so the month's ISS is
 * then less than the rate times the whole emolumentos, and the declaration
 * says so.
 */

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
] as const;

/** "outubro de 2026" for "2026-10". */
export function competenceLabel(competence: string): string {
  const [year, month] = competence.split("-").map(Number);
  return `${MONTHS[(month ?? 1) - 1]} de ${year}`;
}

/** "Outubro de 2026": for a heading or a list. */
export function competenceTitle(competence: string): string {
  const label = competenceLabel(competence);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "003/2026" */
export function formatDeclarationNumber(year: number, sequence: number) {
  return `${String(sequence).padStart(3, "0")}/${year}`;
}

const text = (max: number) => z.string().trim().max(max).default("");

/** What the holder sets once, in Configuração (all editable). */
export const IssSettingsSchema = z.object({
  /** Alíquota in basis points: 500 = 5,00%. LC 116/2003 art. 8º-A: 2% to 5%. */
  rateBasisPoints: z.number().int().min(200).max(500),
  /** "Lei Complementar Municipal nº ..., art. ...": the local ISS law. */
  municipalLaw: text(400),
  authority: text(200),
  department: text(200),
  /** The office's CNPJ and municipal registration, as on its NFS-e. */
  cnpj: text(20),
  municipalRegistration: text(40),
  cnae: text(20),
  /** Day of the next month the ISS is due, when the law fixes one. */
  dueDay: z.number().int().min(1).max(31).nullable().default(null),
  /** The local law or the plano diretor, attached once (PDF). */
  lawAttachment: z
    .object({ path: z.string(), name: z.string() })
    .nullable()
    .default(null),
  /**
   * How the declaration reaches the prefeitura (decision of 11/11/2026):
   * through its website, where the DAM is issued and the PDFs attached, or
   * delivered on paper at the SEMUT, against a receipt.
   */
  filing: z.enum(["portal", "semut"]).default("semut"),
  /** The prefeitura's page where the DAM is issued. */
  portalUrl: z
    .string()
    .trim()
    .max(300)
    .regex(/^(https?:\/\/\S+)?$/)
    .default(""),
  /** The "Receita" picked on that page, as the page names it. */
  portalRevenue: text(120),
});
export type IssSettings = z.infer<typeof IssSettingsSchema>;

export function defaultIssSettings(tenant: Tenant): IssSettings {
  return {
    rateBasisPoints: Math.round((tenant.issRate ?? 0.05) * 10_000),
    municipalLaw: "",
    authority: `Prefeitura Municipal de ${tenant.location.city}/${tenant.location.state}`,
    department: "Secretaria Municipal de Tributação",
    cnpj: "",
    municipalRegistration: "",
    cnae: "6912-5/00",
    dueDay: null,
    lawAttachment: null,
    filing: "semut",
    portalUrl: "",
    portalRevenue: "",
  };
}

export const FILING_LABELS: Record<IssSettings["filing"], string> = {
  portal: "Pelo site da prefeitura (DAM on-line)",
  semut: "Entrega na SEMUT (papel, com protocolo)",
};

/**
 * The day the ISS is due: the one typed, or the configured day of the month
 * after the competence (the last day, in a shorter month).
 */
export function dueDateOf(
  d: { competence: string; dueDate: string },
  settings: Pick<IssSettings, "dueDay">,
): string {
  if (d.dueDate) return d.dueDate;
  if (!settings.dueDay) return "";
  const [year, month] = d.competence.split("-").map(Number);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const last = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
  const day = Math.min(settings.dueDay, last);
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** "5,00%" */
export function formatRate(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(2).replace(".", ",")}%`;
}

/** ISS on the emolumentos, rounded to the centavo. */
export function issOn(emolumentsCents: number, rateBasisPoints: number) {
  return Math.round((emolumentsCents * rateBasisPoints) / 10_000);
}

/** What is typed each month. */
export const IssDeclarationSchema = z.object({
  /** "2026-10" */
  competence: z.string().regex(/^20\d\d-(0[1-9]|1[0-2])$/),
  emolumentsCents: z.number().int().min(0).max(100_000_000_00),
  rateBasisPoints: z.number().int().min(200).max(500),
  /** Optional: the DAM (or guia) number, its due date, the payment date. */
  damNumber: text(60),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .or(z.literal(""))
    .default(""),
  paidOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .or(z.literal(""))
    .default(""),
  notes: text(1000),
  /**
   * The ISS as the system's report works it out act by act; null when it
   * is the rate times the month's emolumentos.
   */
  issCents: z
    .number()
    .int()
    .min(0)
    .max(100_000_000_00)
    .nullable()
    .default(null),
});
export type IssDeclarationInput = z.infer<typeof IssDeclarationSchema>;

/** The month's ISS: the report's, act by act, or the rate on the total. */
export function issOf(d: {
  emolumentsCents: number;
  rateBasisPoints: number;
  issCents?: number | null;
}): number {
  return d.issCents ?? issOn(d.emolumentsCents, d.rateBasisPoints);
}

const money = (cents: number) =>
  `R$ ${formatMoneyBRL(cents)} (${reaisInWords(cents)})`;

const date = (iso: string) =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "";

function writtenDate(iso: string): string {
  return `${Number(iso.slice(8, 10))} de ${MONTHS[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}`;
}

/**
 * The State's funds the office passes parcels on to, by the bulletin's keys.
 * Each State has its own (its law of emolumentos); an office in a State not
 * catalogued yet has none listed, and the texts speak in general terms.
 */
export function fundsOf(tenant: Tenant): { key: string; label: string }[] {
  // The office's reports call the RN fund of the Procuradoria FPGE.
  return (FUNDS_BY_STATE[tenant.location.state] ?? []).map((f) => ({
    key: f.key,
    label: f.key === "funaf" ? "FUNAF/FPGE" : f.label,
  }));
}

/** "FDJ, FRMP, FCRCPN e FUNAF/FPGE": the State's funds, in a sentence. */
export function stateFunds(tenant: Tenant): string {
  const labels = fundsOf(tenant).map((f) => f.label);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} e ${labels.at(-1)}`;
}

/**
 * What stays out of the ISS base, in general terms first (any State), the
 * office's own State as the example (decision of 11/11/2026: the platform
 * serves offices in other States, whose funds have other names).
 */
export function outsideTheBase(tenant: Tenant): string {
  const funds = stateFunds(tenant);
  return [
    "Não integram a base de cálculo os valores que a serventia apenas arrecada e repassa a terceiros, por constituírem receita alheia, com natureza tributária própria. Por exemplo: a taxa de fiscalização devida ao Poder Judiciário, as contribuições aos fundos estaduais (de compensação dos atos gratuitos, do Ministério Público, da Procuradoria do Estado e outros que a lei estadual instituir) e o selo de fiscalização.",
    funds
      ? `Neste Estado (${tenant.location.state}), esses repasses são: ${funds}.`
      : "Os repasses e os seus nomes variam conforme a lei de emolumentos de cada Estado.",
  ].join(" ");
}

/** The law, in the order a fiscal reader checks it. */
export function legalBasis(tenant: Tenant, settings: IssSettings): string[] {
  const local = settings.municipalLaw.trim();
  return [
    "Constituição Federal, art. 156, III: competência municipal para o ISS.",
    "Lei Complementar nº 116/2003, art. 1º e item 21.01 da lista anexa (serviços de registros públicos, cartorários e notariais), art. 7º (base de cálculo: o preço do serviço) e art. 8º-A (alíquota mínima de 2%).",
    "STF, ADI 3.089/DF: incidência do ISS sobre os serviços notariais e de registro. STJ, Primeira Seção, REsp 1.328.384/RS: a base de cálculo é o preço do serviço, isto é, os emolumentos, afastado o regime de valor fixo.",
    "Lei nº 8.935/1994, art. 28, e Lei nº 10.169/2000: emolumentos como remuneração do serviço notarial e de registro.",
    `${tenant.location.state === "RN" ? "Lei Estadual nº 11.038/2021 (RN): emolumentos, Taxa de Fiscalização (FDJ) e demais repasses, que não integram o preço do serviço" : "Lei estadual de emolumentos: os repasses ao Estado e aos fundos não integram o preço do serviço"}.`,
    "Código Nacional de Normas do Foro Extrajudicial (Provimento CNJ nº 149/2023), com a redação do Provimento CN-CNJ nº 259/2026: Livro Diário Auxiliar da Receita e da Despesa, cujas informações podem subsidiar a apuração de tributos.",
    ...(local ? [`${local}.`] : []),
  ];
}

export interface IssDocumentInput {
  declaration: IssDeclarationInput;
  settings: IssSettings;
  year: number;
  sequence: number;
  /** The date the paper is dated (office calendar, "YYYY-MM-DD"). */
  issuedOn: string;
  /** How many papers go attached: the book, the system's reports. */
  attachments: number;
}

/**
 * The declaração on the office's letterhead (the renderer of every other
 * paper, src/lib/pdf.ts): to whom, who declares, the figures, the
 * declaration itself ratifying the attached book, the law, the place and
 * date, the holder.
 */
export function buildIssDocument(
  tenant: Tenant,
  input: IssDocumentInput,
): RequerimentoDocument {
  const { declaration: d, settings: s } = input;
  const iss = issOf(d);
  const byAct = d.issCents !== null && d.issCents !== undefined;
  const attached =
    input.attachments > 1
      ? "do referido mês e nos relatórios do sistema da serventia, cujas cópias seguem anexas e são por esta declaração ratificadas"
      : input.attachments === 1
        ? "do referido mês, cuja cópia segue anexa e é por esta declaração ratificada"
        : "do referido mês, à disposição do fisco municipal";
  const month = competenceLabel(d.competence);
  const number = formatDeclarationNumber(input.year, input.sequence);
  const office = officialName(tenant);
  const holder = holderName(tenant);

  const provider = [
    { label: "Serventia", value: office },
    { label: "CNS", value: tenant.cns },
    ...(s.cnpj.trim() ? [{ label: "CNPJ", value: s.cnpj.trim() }] : []),
    ...(s.municipalRegistration.trim()
      ? [
          {
            label: "Inscrição municipal",
            value: s.municipalRegistration.trim(),
          },
        ]
      : []),
    ...(s.cnae.trim() ? [{ label: "CNAE", value: s.cnae.trim() }] : []),
    {
      label: "Serviço (LC 116/2003)",
      value: "21.01: registros públicos, cartorários e notariais",
    },
  ];

  const figures = [
    { label: "Competência", value: month },
    {
      label: "Base de cálculo (emolumentos)",
      value: money(d.emolumentsCents),
    },
    { label: "Alíquota", value: formatRate(d.rateBasisPoints) },
    {
      label: byAct ? "ISS devido (apurado ato a ato)" : "ISS devido",
      value: money(iss),
    },
    ...(d.damNumber.trim()
      ? [{ label: "DAM/guia de recolhimento", value: d.damNumber.trim() }]
      : []),
    ...(d.dueDate ? [{ label: "Vencimento", value: date(d.dueDate) }] : []),
    ...(d.paidOn ? [{ label: "Recolhido em", value: date(d.paidOn) }] : []),
  ];

  const declarationText = [
    `${holder ? `${holder}, na qualidade de responsável pela serventia ` : "A serventia "}${office}, DECLARA, para fins de apuração e recolhimento do Imposto Sobre Serviços de Qualquer Natureza (ISSQN), que a receita de emolumentos da serventia na competência de ${month} foi de ${money(d.emolumentsCents)}, conforme a produtividade mensal escriturada no Livro Diário Auxiliar da Receita e da Despesa ${attached}.`,
    `${byAct ? `Aplicada a alíquota de ${formatRate(d.rateBasisPoints)} sobre os emolumentos de cada ato, conforme o relatório de valores tributários do sistema da serventia, o ISS devido é de ${money(iss)}${iss < issOn(d.emolumentsCents, d.rateBasisPoints) ? ", não compondo o imposto os atos sem incidência assim apontados no relatório" : ""}` : `Aplicada a alíquota de ${formatRate(d.rateBasisPoints)}, o ISS devido é de ${money(iss)}`}${d.paidOn ? `, recolhido em ${date(d.paidOn)}` : ""}${d.damNumber.trim() ? ` (DAM/guia nº ${d.damNumber.trim()})` : ""}.`,
    "A base de cálculo compreende exclusivamente os emolumentos, que são o preço do serviço notarial e de registro.",
  ];

  const sections: RequerimentoSection[] = [
    {
      heading: "Destinatário",
      paragraphs: [
        `À ${s.department.trim() || "Secretaria Municipal de Tributação"} da ${s.authority.trim() || `Prefeitura Municipal de ${tenant.location.city}`}.`,
      ],
    },
    { heading: "Prestador do serviço", rows: provider },
    { heading: "Apuração", rows: figures },
    {
      heading: "Declaração",
      paragraphs: declarationText,
      highlight: outsideTheBase(tenant),
    },
  ];
  if (d.notes.trim()) {
    sections.push({ heading: "Observações", paragraphs: [d.notes.trim()] });
  }
  sections.push({
    heading: "Fundamentação legal",
    paragraphs: legalBasis(tenant, s),
  });

  return {
    eyebrow: "Fisco municipal · ISSQN",
    title: `Declaração de ISS nº ${number}`,
    subtitle: `Competência: ${month}`,
    office: [office, tenant.subtitle],
    sections,
    dateLine: `${tenant.location.city}/${tenant.location.state}, ${writtenDate(input.issuedOn)}.`,
    signee: holder || undefined,
    signature: [tenant.holderTitle ?? "Tabelião/Registrador"],
    footer: `${office} · Declaração de ISS nº ${number} · ${tenant.legalFooter}`,
  };
}

export interface FilingInput {
  declaration: IssDeclarationInput;
  settings: IssSettings;
  year: number;
  sequence: number;
  attachments: number;
}

/**
 * What the prefeitura's DAM page asks, in its order, ready to copy: who
 * pays, the revenue, the amount, a description the fiscal reader
 * understands on its own, the day to pay.
 */
export function portalFields(
  tenant: Tenant,
  input: FilingInput,
): { key: string; label: string; value: string }[] {
  const { declaration: d, settings: s } = input;
  const iss = issOf(d);
  const [year, month] = d.competence.split("-");
  const number = formatDeclarationNumber(input.year, input.sequence);
  const byAct = d.issCents !== null && d.issCents !== undefined;
  const description = [
    `ISSQN da competência ${month}/${year}: serviços notariais e de registro (LC 116/2003, item 21.01).`,
    `Base de cálculo: emolumentos de R$ ${formatMoneyBRL(d.emolumentsCents)}; alíquota de ${formatRate(d.rateBasisPoints)}; ISS de R$ ${formatMoneyBRL(iss)}${byAct ? ", apurado ato a ato" : ""}.`,
    `Conforme a Declaração de ISS nº ${number}${input.attachments ? ", com o Livro Diário Auxiliar e os relatórios do mês anexos" : ""}.`,
  ].join(" ");
  return [
    { key: "documento", label: "CPF / CNPJ", value: s.cnpj.trim() },
    { key: "nome", label: "Nome / Razão social", value: officialName(tenant) },
    { key: "receita", label: "Receita", value: s.portalRevenue.trim() },
    { key: "valor", label: "Valor a pagar", value: formatMoneyBRL(iss) },
    { key: "descricao", label: "Descrição", value: description },
    {
      key: "vencimento",
      label: "Data para pagamento",
      value: date(dueDateOf(d, s)),
    },
  ];
}

/**
 * The receipt for the SEMUT counter: one page that stays with the office,
 * stamped and signed by whoever receives the declaration.
 */
export function buildFilingReceipt(
  tenant: Tenant,
  input: FilingInput,
): RequerimentoDocument {
  const { declaration: d, settings: s } = input;
  const number = formatDeclarationNumber(input.year, input.sequence);
  const office = officialName(tenant);
  const blank = "_______________________________________";
  return {
    eyebrow: "Fisco municipal · ISSQN",
    title: "Protocolo de entrega",
    subtitle: `Declaração de ISS nº ${number} · competência ${competenceLabel(d.competence)}`,
    office: [office, tenant.subtitle],
    sections: [
      {
        heading: "Entregue",
        rows: [
          {
            label: "Destinatário",
            value: `${s.department.trim() || "Secretaria Municipal de Tributação"} da ${s.authority.trim() || `Prefeitura Municipal de ${tenant.location.city}`}`,
          },
          { label: "Serventia", value: office },
          ...(s.cnpj.trim() ? [{ label: "CNPJ", value: s.cnpj.trim() }] : []),
          { label: "Documento", value: `Declaração de ISS nº ${number}` },
          { label: "Competência", value: competenceLabel(d.competence) },
          { label: "ISS declarado", value: money(issOf(d)) },
          {
            label: "Anexos",
            value: input.attachments
              ? `${input.attachments} (Livro Diário Auxiliar e relatórios do mês)`
              : "nenhum",
          },
        ],
      },
      {
        heading: "Recebimento (preenchido pela SEMUT)",
        rows: [
          { label: "Recebido em", value: "____/____/________, às ____:____" },
          { label: "Nº do protocolo", value: blank },
          { label: "Servidor (nome)", value: blank },
          { label: "Matrícula", value: blank },
          { label: "Assinatura e carimbo", value: blank },
        ],
      },
    ],
    signature: ["Via da serventia: guardar com a cópia da declaração."],
    footer: `${office} · Protocolo de entrega da Declaração de ISS nº ${number} · ${tenant.legalFooter}`,
  };
}

/** "declaracao-iss-2026-10.pdf" */
export function issFileName(competence: string): string {
  return `declaracao-iss-${competence}.pdf`;
}
