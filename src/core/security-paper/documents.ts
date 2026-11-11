import { z } from "zod";
import type {
  RequerimentoDocument,
  RequerimentoSection,
} from "../request/requerimento.ts";
import { holderName, officialName } from "../tenant/identification.ts";
import type { Tenant } from "../tenant/schema.ts";
import {
  brDate,
  COMMUNICABLE,
  freeRanges,
  kindName,
  MOVEMENT_COLUMNS,
  MOVEMENT_LABELS,
  MOVEMENT_TYPES,
  type MovementType,
  monthLabel,
  type PaperLot,
  type PaperMovement,
  type Period,
  periodLabel,
  rangeLabel,
  type SummaryRow,
  sheetsIn,
  summarize,
  totalOf,
  writtenDate,
} from "./stock.ts";

/**
 * The papers the classificador produces (decision of 11/11/2026), three
 * models, each written for its reader:
 *
 * - "extravio": the ofício of art. 59, the losses, thefts and damages of
 *   the month, sheet by sheet, so the Corregedoria publishes them in the
 *   DJe and tells the judges and the other States' Corregedorias;
 * - "prestacao": the ofício of art. 60, § 1º, the quarter's accounts, with
 *   the demonstrativo by kind and the numbering behind every figure;
 * - "relatorio": the classificador itself (art. 60, caput), for the
 *   office's own file and for an inspection: the lots, with the nota and
 *   the printer when there are, every movement and the stock.
 *
 * What a paper says is frozen when it is issued (`ReportSnapshot`): the
 * ofício nº 012/2026 reads the same in a year, whatever is corrected after.
 */

export const REPORT_KINDS = ["extravio", "prestacao", "relatorio"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_LABELS: Record<ReportKind, string> = {
  extravio: "Comunicação de extravio, subtração ou avaria (art. 59)",
  prestacao: "Prestação de contas trimestral (art. 60, § 1º)",
  relatorio: "Relatório do classificador (art. 60)",
};

/** Short, for lists and file names. */
export const REPORT_SHORT: Record<ReportKind, string> = {
  extravio: "Comunicação de extravio",
  prestacao: "Prestação de contas",
  relatorio: "Relatório do classificador",
};

const STATE_NAMES: Record<string, string> = {
  AC: "do Acre",
  AL: "de Alagoas",
  AP: "do Amapá",
  AM: "do Amazonas",
  BA: "da Bahia",
  CE: "do Ceará",
  DF: "do Distrito Federal e dos Territórios",
  ES: "do Espírito Santo",
  GO: "de Goiás",
  MA: "do Maranhão",
  MT: "de Mato Grosso",
  MS: "de Mato Grosso do Sul",
  MG: "de Minas Gerais",
  PA: "do Pará",
  PB: "da Paraíba",
  PR: "do Paraná",
  PE: "de Pernambuco",
  PI: "do Piauí",
  RJ: "do Rio de Janeiro",
  RN: "do Rio Grande do Norte",
  RS: "do Rio Grande do Sul",
  RO: "de Rondônia",
  RR: "de Roraima",
  SC: "de Santa Catarina",
  SP: "de São Paulo",
  SE: "de Sergipe",
  TO: "do Tocantins",
};

const text = (max: number) => z.string().trim().max(max).default("");

/** To whom the ofícios go and under which rule; all editable. */
export const SecurityPaperSettingsSchema = z.object({
  authority: text(200),
  /** Who heads it, by name (optional), and the title. */
  headName: text(160),
  headTitle: text(160),
  address: text(300),
  email: text(160),
  /** The State's rule, as cited ("Provimento nº 156/2016-CGJ/RN ..."). */
  stateRule: text(400),
  /** Day of the month after the quarter the accounts are due, if set. */
  deadlineDay: z.number().int().min(1).max(31).nullable().default(null),
});
export type SecurityPaperSettings = z.infer<typeof SecurityPaperSettingsSchema>;

export const RN_RULE =
  "Provimento nº 156/2016-CGJ/RN (Código de Normas do Foro Extrajudicial do Estado do Rio Grande do Norte)";

export function defaultSecurityPaperSettings(
  tenant: Pick<Tenant, "location">,
): SecurityPaperSettings {
  const uf = tenant.location.state;
  return {
    authority: `Corregedoria Geral de Justiça do Estado ${STATE_NAMES[uf] ?? `(${uf})`}`,
    headName: "",
    headTitle: "Desembargador(a) Corregedor(a)-Geral da Justiça",
    address: "",
    email: "",
    stateRule: uf === "RN" ? RN_RULE : "",
    deadlineDay: null,
  };
}

/**
 * The State's rule with its articles, after "em cumprimento" (`a`) or
 * "nos termos" (`de`); without a rule set, the Corregedoria's norms in
 * general terms, never another State's articles.
 */
function ruleOf(
  s: SecurityPaperSettings,
  articles: string,
  prep: "a" | "de",
): string {
  const rule = s.stateRule.trim();
  if (rule) return `${prep === "a" ? "ao" : "do"} ${articles} do ${rule}`;
  return `${prep === "a" ? "às" : "das"} normas da Corregedoria Geral de Justiça sobre o papel de segurança`;
}

/* --------------------------------------------------------------- snapshot */

export interface SnapshotMovement {
  id: string;
  type: MovementType;
  kind: string;
  range: string;
  quantity: number;
  occurredOn: string;
  reference: string;
  notes: string;
}

export interface ReportSnapshot {
  kind: ReportKind;
  period: Period;
  /** "YYYY-MM-DD": the day the paper is dated. */
  issuedOn: string;
  /** "012/2026" for an ofício; null for the classificador's report. */
  number: string | null;
  settings: SecurityPaperSettings;
  summary: SummaryRow[];
  received: {
    kind: string;
    range: string;
    quantity: number;
    receivedOn: string;
    opening: boolean;
    supplier: string;
    invoice: string;
    requisition: string;
  }[];
  movements: SnapshotMovement[];
  remaining: { kind: string; ranges: string[]; quantity: number }[];
  /** The ofícios of art. 59 issued in the period ("003/2026"). */
  toldBy: string[];
  notes: string;
  signer: { name: string; title: string; note?: string } | null;
}

export function buildSnapshot(input: {
  kind: ReportKind;
  period: Period;
  issuedOn: string;
  number: string | null;
  settings: SecurityPaperSettings;
  lots: readonly PaperLot[];
  movements: readonly PaperMovement[];
  /** For "extravio": the movements told (defaults to the period's). */
  movementIds?: readonly string[];
  toldBy?: string[];
  notes?: string;
  signer?: { name: string; title: string; note?: string } | null;
}): ReportSnapshot {
  const { period } = input;
  const lots = input.lots.filter((l) => !l.voided);
  const byId = new Map(lots.map((l) => [l.id, l]));
  const inPeriod = input.movements.filter(
    (m) =>
      !m.voided &&
      byId.has(m.lotId) &&
      m.occurredOn >= period.start &&
      m.occurredOn <= period.end,
  );
  const chosen =
    input.kind === "extravio"
      ? inPeriod.filter(
          (m) =>
            COMMUNICABLE.includes(m.type) &&
            (!input.movementIds || input.movementIds.includes(m.id)),
        )
      : inPeriod;
  const movements = chosen
    .map((m) => {
      const lot = byId.get(m.lotId) as PaperLot;
      return {
        id: m.id,
        type: m.type,
        kind: kindName(lot),
        range: rangeLabel(lot, m.first, m.last),
        quantity: sheetsIn(m),
        occurredOn: m.occurredOn,
        reference: m.reference,
        notes: m.notes,
      };
    })
    .sort(
      (a, b) =>
        a.occurredOn.localeCompare(b.occurredOn) ||
        a.kind.localeCompare(b.kind) ||
        a.range.localeCompare(b.range),
    );

  const received = lots
    .filter((l) =>
      input.kind === "relatorio"
        ? l.receivedOn <= period.end
        : !l.opening &&
          l.receivedOn >= period.start &&
          l.receivedOn <= period.end,
    )
    .sort((a, b) => a.receivedOn.localeCompare(b.receivedOn))
    .map((l) => ({
      kind: kindName(l),
      range: rangeLabel(l, l.first, l.last),
      quantity: sheetsIn(l),
      receivedOn: l.receivedOn,
      opening: l.opening,
      supplier: l.supplier,
      invoice: l.invoice,
      requisition: l.requisition,
    }));

  const remainingByKind = new Map<
    string,
    { ranges: string[]; quantity: number }
  >();
  for (const lot of lots.filter((l) => l.receivedOn <= period.end)) {
    const entry = remainingByKind.get(kindName(lot)) ?? {
      ranges: [],
      quantity: 0,
    };
    for (const r of freeRanges(lot, input.movements, period.end)) {
      entry.ranges.push(rangeLabel(lot, r.first, r.last));
      entry.quantity += sheetsIn(r);
    }
    remainingByKind.set(kindName(lot), entry);
  }

  return {
    kind: input.kind,
    period,
    issuedOn: input.issuedOn,
    number: input.number,
    settings: input.settings,
    summary:
      input.kind === "extravio" ? [] : summarize(lots, input.movements, period),
    received: input.kind === "extravio" ? [] : received,
    movements,
    remaining:
      input.kind === "extravio"
        ? []
        : [...remainingByKind.entries()]
            .map(([kind, v]) => ({ kind, ...v }))
            .sort((a, b) => a.kind.localeCompare(b.kind)),
    toldBy: input.toldBy ?? [],
    notes: input.notes?.trim() ?? "",
    signer: input.signer ?? null,
  };
}

/* -------------------------------------------------------------- documents */

const n = (value: number) => value.toLocaleString("pt-BR");

function addressee(s: SecurityPaperSettings): RequerimentoSection {
  const head = s.headName.trim();
  return {
    heading: "Destinatário",
    rows: [
      {
        label: "A Sua Excelência",
        value:
          [head, s.headTitle.trim()].filter(Boolean).join(", ") ||
          "Corregedor(a)-Geral da Justiça",
      },
      {
        label: "Órgão",
        value: s.authority.trim() || "Corregedoria Geral de Justiça",
      },
      ...(s.address.trim()
        ? [{ label: "Endereço", value: s.address.trim() }]
        : []),
      ...(s.email.trim() ? [{ label: "E-mail", value: s.email.trim() }] : []),
    ],
  };
}

function demonstrativo(snapshot: ReportSnapshot): RequerimentoSection["table"] {
  const total = totalOf(snapshot.summary);
  const cells = (r: SummaryRow) => [
    r.kind,
    n(r.initial),
    n(r.received),
    ...MOVEMENT_TYPES.map((t) => n(r.moved[t])),
    n(r.final),
  ];
  return {
    columns: [
      { label: "Espécie", weight: 1.7 },
      { label: "Inicial", align: "right" },
      { label: "Recebidas", align: "right" },
      ...MOVEMENT_TYPES.map((t) => ({
        label: MOVEMENT_COLUMNS[t],
        align: "right" as const,
      })),
      { label: "Final", align: "right" },
    ],
    rows: snapshot.summary.map(cells),
    total: snapshot.summary.length > 1 ? cells(total) : undefined,
    empty: "Nenhum papel de segurança cadastrado até o fim do período.",
  };
}

function movementsTable(
  movements: SnapshotMovement[],
  empty: string,
): RequerimentoSection["table"] {
  return {
    columns: [
      { label: "Data", weight: 1 },
      { label: "Ocorrência", weight: 1.4 },
      { label: "Espécie", weight: 1.6 },
      { label: "Numeração", weight: 2.2 },
      { label: "Qtd.", weight: 0.6, align: "right" },
      { label: "Referência", weight: 1.8 },
    ],
    rows: movements.map((m) => [
      brDate(m.occurredOn),
      MOVEMENT_COLUMNS[m.type].replace(/s$/, ""),
      m.kind,
      m.range,
      n(m.quantity),
      [m.reference, m.notes].filter((t) => t.trim()).join(" · "),
    ]),
    empty,
  };
}

function receivedTable(snapshot: ReportSnapshot): RequerimentoSection["table"] {
  return {
    columns: [
      { label: "Recebido em", weight: 1 },
      { label: "Espécie", weight: 1.5 },
      { label: "Numeração", weight: 2.1 },
      { label: "Qtd.", weight: 0.6, align: "right" },
      { label: "Gráfica / nota fiscal / requisição", weight: 2.3 },
    ],
    rows: snapshot.received.map((r) => [
      r.opening
        ? `${brDate(r.receivedOn)} (estoque anterior)`
        : brDate(r.receivedOn),
      r.kind,
      r.range,
      n(r.quantity),
      [
        r.supplier && `Gráfica: ${r.supplier}`,
        r.invoice && `NF ${r.invoice}`,
        r.requisition && `Req. ${r.requisition}`,
      ]
        .filter(Boolean)
        .join(" · ") || "Não informado",
    ]),
    empty: "Nenhum lote recebido no período.",
  };
}

function remainingTable(
  snapshot: ReportSnapshot,
): RequerimentoSection["table"] {
  return {
    columns: [
      { label: "Espécie", weight: 1.5 },
      { label: "Folhas em estoque (numeração)", weight: 4 },
      { label: "Qtd.", weight: 0.6, align: "right" },
    ],
    rows: snapshot.remaining.map((r) => [
      r.kind,
      r.ranges.join("; ") || "Sem folhas em estoque",
      n(r.quantity),
    ]),
    empty: "Sem folhas em estoque.",
  };
}

interface Context {
  tenant: Tenant;
  snapshot: ReportSnapshot;
}

function signerOf({ tenant, snapshot }: Context) {
  const holder = holderName(tenant);
  const chosen = snapshot.signer?.name.trim() ? snapshot.signer : null;
  const signer =
    chosen ??
    (holder
      ? { name: holder, title: tenant.holderTitle ?? "Tabelião/Registrador" }
      : null);
  const isHolder = !chosen || chosen.name.trim() === holder;
  return { signer, isHolder };
}

function frame(
  ctx: Context,
  parts: {
    eyebrow: string;
    title: string;
    subtitle: string;
    sections: RequerimentoSection[];
    footer: string;
  },
): RequerimentoDocument {
  const { tenant, snapshot } = ctx;
  const office = officialName(tenant);
  const { signer } = signerOf(ctx);
  return {
    eyebrow: parts.eyebrow,
    title: parts.title,
    subtitle: parts.subtitle,
    office: [office, tenant.subtitle],
    sections: parts.sections,
    dateLine: `${tenant.location.city}/${tenant.location.state}, ${writtenDate(snapshot.issuedOn)}.`,
    signee: signer?.name || undefined,
    signature: [
      signer?.title || tenant.holderTitle || "Tabelião/Registrador",
      ...(snapshot.signer?.note?.trim() ? [snapshot.signer.note.trim()] : []),
    ],
    footer: `${office} · ${parts.footer} · ${tenant.legalFooter}`,
  };
}

/** "Fulano, Tabelião da serventia X," or "A serventia X,". */
function who(ctx: Context): string {
  const office = officialName(ctx.tenant);
  const { signer, isHolder } = signerOf(ctx);
  if (!signer) return `A serventia ${office}`;
  return isHolder
    ? `${signer.name}, responsável pela serventia ${office},`
    : `${signer.name}, ${signer.title.trim() || "preposto(a)"} da serventia ${office},`;
}

const officeRows = (tenant: Tenant) => [
  { label: "Serventia", value: officialName(tenant) },
  { label: "CNS", value: tenant.cns },
  {
    label: "Município",
    value: `${tenant.location.city}/${tenant.location.state}`,
  },
];

const basis = (
  s: SecurityPaperSettings,
  articles: string,
  extra: string[] = [],
) => [
  ...(s.stateRule.trim()
    ? [`${s.stateRule.trim()}, ${articles}.`]
    : [
        "Normas da Corregedoria Geral de Justiça do Estado sobre o controle do papel de segurança.",
      ]),
  "Lei nº 8.935/1994, art. 30, I e XIV: dever de manter em ordem e guardar em local seguro os livros, papéis e documentos da serventia e de observar as normas técnicas do juízo competente.",
  ...extra,
];

/** The ofício of art. 59: the month's losses, thefts and damages. */
export function buildExtravioOficio(
  tenant: Tenant,
  snapshot: ReportSnapshot,
): RequerimentoDocument {
  const ctx = { tenant, snapshot };
  const s = snapshot.settings;
  const total = snapshot.movements.reduce((sum, m) => sum + m.quantity, 0);
  const kinds = [...new Set(snapshot.movements.map((m) => m.type))]
    .map((t) => MOVEMENT_LABELS[t].split(" (")[0]?.toLowerCase())
    .join(", ");
  const apostila = snapshot.movements.some((m) => /apostila/i.test(m.kind));
  const period = periodLabel(snapshot.period);
  return frame(ctx, {
    eyebrow: `Ofício nº ${snapshot.number ?? ""}`,
    title: "Comunicação de extravio, subtração ou avaria de papel de segurança",
    subtitle: `Período: ${period}`,
    footer: `Ofício nº ${snapshot.number} (papel de segurança)`,
    sections: [
      addressee(s),
      { heading: "Remetente", rows: officeRows(tenant) },
      {
        heading: "Comunicação",
        paragraphs: [
          "Excelentíssimo(a) Senhor(a) Corregedor(a)-Geral,",
          `${who(ctx)} em cumprimento ${ruleOf(s, "art. 59", "a")}, COMUNICA a Vossa Excelência que ${total === 1 ? "a folha de papel de segurança abaixo identificada foi" : `as ${n(total)} folhas de papel de segurança abaixo identificadas foram`} ${kinds || "extraviadas, subtraídas ou avariadas"} em ${period}, conforme a numeração respectiva.`,
          "Requer a publicação no Diário da Justiça Eletrônico (DJe) e a comunicação aos Juízes Corregedores Permanentes e às Corregedorias Gerais de Justiça dos demais Estados da Federação, para que as folhas indicadas não sejam aceitas como suporte de ato válido.",
          "Os documentos do fato e o controle do papel de segurança estão arquivados no classificador próprio da serventia de que trata a mesma norma, à disposição desta Corregedoria.",
        ],
      },
      {
        heading: "Folhas extraviadas, subtraídas ou avariadas",
        table: movementsTable(
          snapshot.movements,
          "Nenhuma ocorrência no período.",
        ),
      },
      ...(snapshot.notes
        ? [{ heading: "Observações", paragraphs: [snapshot.notes] }]
        : []),
      {
        heading: "Fundamentação",
        paragraphs: basis(
          s,
          "art. 59",
          apostila
            ? [
                "Provimento CNJ nº 62/2017 (apostilamento), consolidado no Código Nacional de Normas (Provimento CNJ nº 149/2023): o extravio do papel de segurança da apostila é comunicado à Corregedoria-Geral, que dá publicidade ao fato.",
              ]
            : [],
        ),
      },
      {
        heading: "Encerramento",
        paragraphs: ["Respeitosamente,"],
      },
    ],
  });
}

/** The ofício of art. 60, § 1º: the quarter's accounts. */
export function buildPrestacaoOficio(
  tenant: Tenant,
  snapshot: ReportSnapshot,
): RequerimentoDocument {
  const ctx = { tenant, snapshot };
  const s = snapshot.settings;
  const total = totalOf(snapshot.summary);
  const period = periodLabel(snapshot.period);
  const losses =
    total.moved.extraviado + total.moved.subtraido + total.moved.avariado;
  const told = snapshot.toldBy.length
    ? ` comunicadas pelo${snapshot.toldBy.length > 1 ? "s" : ""} Ofício${snapshot.toldBy.length > 1 ? "s" : ""} nº ${snapshot.toldBy.join(", ")}`
    : "";
  return frame(ctx, {
    eyebrow: `Ofício nº ${snapshot.number ?? ""}`,
    title: "Prestação de contas do papel de segurança",
    subtitle: `Período: ${period}`,
    footer: `Ofício nº ${snapshot.number} (prestação de contas)`,
    sections: [
      addressee(s),
      { heading: "Remetente", rows: officeRows(tenant) },
      {
        heading: "Prestação de contas",
        paragraphs: [
          "Excelentíssimo(a) Senhor(a) Corregedor(a)-Geral,",
          `${who(ctx)} em cumprimento ${ruleOf(s, "art. 60, § 1º", "a")}, PRESTA CONTAS a Vossa Excelência da utilização do papel de segurança no ${period}, discriminando o estoque inicial, os papéis recebidos, utilizados, inutilizados, avariados, extraviados e subtraídos e o quantitativo remanescente, conforme o demonstrativo abaixo e o detalhamento da numeração anexo.`,
          `No período, a serventia recebeu ${n(total.received)} folha(s), utilizou ${n(total.moved.utilizado)}, inutilizou ${n(total.moved.inutilizado)} e registrou ${n(losses)} folha(s) extraviada(s), subtraída(s) ou avariada(s)${losses ? told || ", objeto de comunicação nos termos do art. 59" : ""}. Restam em estoque ${n(total.final)} folha(s).`,
          "Declara que as informações conferem com os documentos de requisição e de recebimento e com o controle de uso arquivados no classificador próprio da serventia, à disposição desta Corregedoria.",
        ],
      },
      { heading: "Demonstrativo por espécie", table: demonstrativo(snapshot) },
      ...(snapshot.notes
        ? [{ heading: "Observações", paragraphs: [snapshot.notes] }]
        : []),
      {
        heading: "Fundamentação",
        paragraphs: basis(s, "art. 60, caput e §§ 1º e 2º"),
      },
      { heading: "Encerramento", paragraphs: ["Respeitosamente,"] },
    ],
  });
}

/** The annex: the numbering behind each figure of the accounts. */
export function buildPrestacaoAnexo(
  tenant: Tenant,
  snapshot: ReportSnapshot,
): RequerimentoDocument {
  const ctx = { tenant, snapshot };
  return frame(ctx, {
    eyebrow: `Anexo ao Ofício nº ${snapshot.number ?? ""}`,
    title: "Detalhamento da numeração do papel de segurança",
    subtitle: `Período: ${periodLabel(snapshot.period)}`,
    footer: `Anexo ao Ofício nº ${snapshot.number}`,
    sections: [
      { heading: "Lotes recebidos no período", table: receivedTable(snapshot) },
      {
        heading:
          "Folhas utilizadas, inutilizadas, avariadas, extraviadas e subtraídas",
        table: movementsTable(
          snapshot.movements,
          "Nenhum lançamento no período.",
        ),
      },
      {
        heading: `Estoque em ${brDate(snapshot.period.end)}`,
        table: remainingTable(snapshot),
      },
    ],
  });
}

/** The classificador (art. 60, caput), for the office and an inspection. */
export function buildRelatorio(
  tenant: Tenant,
  snapshot: ReportSnapshot,
): RequerimentoDocument {
  const ctx = { tenant, snapshot };
  return frame(ctx, {
    eyebrow: "Classificador do papel de segurança",
    title: "Relatório de controle do papel de segurança",
    subtitle: `Período: ${periodLabel(snapshot.period)}`,
    footer: "Relatório do classificador do papel de segurança",
    sections: [
      { heading: "Serventia", rows: officeRows(tenant) },
      {
        heading: "Apresentação",
        paragraphs: [
          `Controle do papel de segurança da serventia no período de ${periodLabel(snapshot.period)}, mantido em classificador próprio nos termos ${ruleOf(snapshot.settings, "art. 60", "de")}: as folhas recebidas, utilizadas e o estoque existente, com os documentos de requisição e de recebimento de cada lote.`,
        ],
      },
      { heading: "Movimento por espécie", table: demonstrativo(snapshot) },
      {
        heading: "Lotes do classificador",
        table: receivedTable(snapshot),
      },
      {
        heading: "Lançamentos do período",
        table: movementsTable(
          snapshot.movements,
          "Nenhum lançamento no período.",
        ),
      },
      {
        heading: `Estoque em ${brDate(snapshot.period.end)}`,
        table: remainingTable(snapshot),
      },
      ...(snapshot.notes
        ? [{ heading: "Observações", paragraphs: [snapshot.notes] }]
        : []),
    ],
  });
}

/** Every page of a paper, in order: the ofício and, for the accounts, its annex. */
export function buildReportDocuments(
  tenant: Tenant,
  snapshot: ReportSnapshot,
): RequerimentoDocument[] {
  if (snapshot.kind === "extravio")
    return [buildExtravioOficio(tenant, snapshot)];
  if (snapshot.kind === "prestacao") {
    return [
      buildPrestacaoOficio(tenant, snapshot),
      buildPrestacaoAnexo(tenant, snapshot),
    ];
  }
  return [buildRelatorio(tenant, snapshot)];
}

/* -------------------------------------------------------------- planilha */

const csvCell = (value: string | number) => {
  const t = String(value);
  return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/**
 * The same figures as a spreadsheet (";" and a BOM, as Excel in Portuguese
 * opens it): the demonstrativo, the lots and every movement.
 */
export function reportCsv(snapshot: ReportSnapshot): string {
  const lines: (string | number)[][] = [];
  lines.push([REPORT_LABELS[snapshot.kind]]);
  lines.push(["Período", periodLabel(snapshot.period)]);
  if (snapshot.number) lines.push(["Ofício nº", snapshot.number]);
  lines.push([]);
  if (snapshot.kind !== "extravio") {
    lines.push([
      "Espécie",
      "Estoque inicial",
      "Recebidas",
      ...MOVEMENT_TYPES.map((t) => MOVEMENT_COLUMNS[t]),
      "Estoque final",
    ]);
    for (const r of [...snapshot.summary, totalOf(snapshot.summary)]) {
      lines.push([
        r.kind,
        r.initial,
        r.received,
        ...MOVEMENT_TYPES.map((t) => r.moved[t]),
        r.final,
      ]);
    }
    lines.push([]);
    lines.push([
      "Lote recebido em",
      "Espécie",
      "Numeração",
      "Quantidade",
      "Gráfica",
      "Nota fiscal",
      "Requisição",
    ]);
    for (const r of snapshot.received) {
      lines.push([
        brDate(r.receivedOn) + (r.opening ? " (estoque anterior)" : ""),
        r.kind,
        r.range,
        r.quantity,
        r.supplier,
        r.invoice,
        r.requisition,
      ]);
    }
    lines.push([]);
  }
  lines.push([
    "Data",
    "Ocorrência",
    "Espécie",
    "Numeração",
    "Quantidade",
    "Referência",
    "Observação",
  ]);
  for (const m of snapshot.movements) {
    lines.push([
      brDate(m.occurredOn),
      MOVEMENT_LABELS[m.type],
      m.kind,
      m.range,
      m.quantity,
      m.reference,
      m.notes,
    ]);
  }
  if (snapshot.kind !== "extravio") {
    lines.push([]);
    lines.push(["Espécie", "Estoque (numeração)", "Quantidade"]);
    for (const r of snapshot.remaining) {
      lines.push([r.kind, r.ranges.join("; "), r.quantity]);
    }
  }
  return `﻿${lines.map((l) => l.map(csvCell).join(";")).join("\r\n")}\r\n`;
}

/** "papel-seguranca-prestacao-2026-T3.pdf" and alike. */
export function reportFileName(snapshot: ReportSnapshot, ext: "pdf" | "csv") {
  const { start, end } = snapshot.period;
  const tag =
    snapshot.kind === "prestacao" && start.slice(5, 7) !== end.slice(5, 7)
      ? `${start.slice(0, 4)}-T${Math.ceil(Number(end.slice(5, 7)) / 3)}`
      : snapshot.kind === "extravio"
        ? start.slice(0, 7)
        : `${start}_${end}`;
  return `papel-seguranca-${snapshot.kind}-${tag}.${ext}`;
}

export { monthLabel };
