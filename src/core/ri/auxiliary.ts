import { brDate, isoDate } from "./property.ts";

/**
 * The Livro 3 (Registro Auxiliar): the registros the law gives the
 * Registro de Imóveis that do not concern a matrícula directly (Lei nº
 * 6.015/1973, art. 177), one by one in art. 178. A registro here has no
 * imóvel of its own: it has a título, parties, and, as the case may be,
 * value, vencimento, the goods given in penhor and where they are, the
 * regime of a pacto antenupcial, the matrículas it refers to (for the
 * remissões recíprocas). Pure: the screens and the service read it.
 */

export type AuxRole =
  | "emitente"
  | "devedor"
  | "credor"
  | "avalista"
  | "interveniente"
  | "depositario"
  | "conjuge"
  | "emissora"
  | "agente"
  | "condominio"
  | "requerente"
  | "outro";

export const AUX_ROLE_LABELS: Record<AuxRole, string> = {
  emitente: "Emitente",
  devedor: "Devedor",
  credor: "Credor",
  avalista: "Avalista",
  interveniente: "Interveniente garantidor",
  depositario: "Fiel depositário",
  conjuge: "Cônjuge (nubente)",
  emissora: "Emissora",
  agente: "Agente fiduciário",
  condominio: "Condomínio ou instituidor",
  requerente: "Requerente",
  outro: "Outra parte",
};

export interface AuxParty {
  name: string;
  document: string;
  role: AuxRole;
}

/**
 * An anotação on the registro (a remissão, a note that the same título is
 * also in the RTD, an observação of the oficial). Editing keeps the old
 * text; "apagar" only hides it (decision of 20/11/2026).
 */
export interface AuxNote {
  id: string;
  on: string | null;
  text: string;
  at: string;
  by: string;
  deletedAt: string | null;
  history: { at: string; by: string; text: string; on: string | null }[];
}

export interface AuxData {
  /** "Cédula de crédito industrial nº 123", "Escritura de pacto antenupcial". */
  title: string;
  issuedOn: string | null;
  valueCents: number | null;
  dueOn: string | null;
  paymentPlace: string;
  /** Forma de pagamento, juros e encargos, as the título says. */
  terms: string;
  /** The goods given in penhor or the guarantees, as described. */
  guarantees: string;
  /** Where the goods are (the imóvel, its matrícula), when it applies. */
  goodsPlace: string;
  /** Pacto antenupcial. */
  regime: string;
  weddingOn: string | null;
  domicile: string;
  /** The escritura: tabelionato, livro, folhas. */
  deed: string;
  protocolNumber: string;
  protocolOn: string | null;
  parties: AuxParty[];
  /** Anotações: managed on the registro's page, never by its form. */
  annotations: AuxNote[];
}

export const EMPTY_AUX: AuxData = {
  title: "",
  issuedOn: null,
  valueCents: null,
  dueOn: null,
  paymentPlace: "",
  terms: "",
  guarantees: "",
  goodsPlace: "",
  regime: "",
  weddingOn: null,
  domicile: "",
  deed: "",
  protocolNumber: "",
  protocolOn: null,
  parties: [],
  annotations: [],
};

export interface HowToStep {
  step: string;
  source: string;
}

export interface AuxGuide {
  /** AUX_KINDS name it applies to (matched by its start). */
  match: RegExp;
  roles: AuxRole[];
  /** Which blocks of the form make sense. */
  money: boolean;
  goods: boolean;
  pacto: boolean;
  howTo: HowToStep[];
}

/** What each kind of registro asks, and how to do it, step by step. */
export const AUX_GUIDES: AuxGuide[] = [
  {
    match: /^contrato de penhor rural|^penhor rural|c[eé]dula rural pignorat/i,
    roles: [
      "emitente",
      "credor",
      "avalista",
      "interveniente",
      "depositario",
      "outro",
    ],
    money: true,
    goods: true,
    pacto: false,
    howTo: [
      {
        step: "Confira se os bens empenhados (gado, safra, máquinas agrícolas) estão nesta circunscrição: o penhor rural se registra no Registro de Imóveis de onde estão as coisas empenhadas.",
        source: "Código Civil, art. 1.438; Lei nº 6.015/1973, art. 178, VI",
      },
      {
        step: "Cédula rural pignoratícia: desde a Lei nº 13.986/2020 a cédula em si não é mais inscrita no Registro de Imóveis (foram revogados o art. 167, I, 13, da Lei nº 6.015/1973 e os arts. 30 a 40 do Decreto-Lei nº 167/1967). O que se registra é o penhor rural que ela constitui, aqui no Livro 3.",
        source:
          "Lei nº 13.986/2020, art. 61; Código Civil, art. 1.438 e parágrafo único; Lei nº 6.015/1973, art. 178, VI",
      },
      {
        step: "Registre o penhor no Livro 3 com o título, o emitente, o credor, o valor, o vencimento, os bens empenhados e o imóvel onde estão.",
        source: "Lei nº 6.015/1973, arts. 167, I, 15, e 178, VI",
      },
      {
        step: "Se a mesma cédula também dá hipoteca de imóvel (cédula rural pignoratícia e hipotecária), a hipoteca cedular vai como R na matrícula do imóvel (Livro 2), com remissão recíproca a este registro.",
        source:
          "Decreto-Lei nº 167/1967, arts. 23 e 24; Lei nº 6.015/1973, art. 167, I, 2",
      },
      {
        step: "Aditivo, endosso e quitação se averbam à margem deste registro (AV). A baixa do penhor é averbação de cancelamento, a pedido do credor com documento hábil.",
        source: "Lei nº 6.015/1973, art. 250, II e III",
      },
    ],
  },
  {
    match: /c[eé]dula rural hipotec[aá]ria|c[eé]dula de cr[eé]dito rural/i,
    roles: ["emitente", "credor", "avalista", "interveniente", "outro"],
    money: true,
    goods: true,
    pacto: false,
    howTo: [
      {
        step: "A cédula de crédito rural não se inscreve mais no Registro de Imóveis (Lei nº 13.986/2020 revogou o art. 167, I, 13, da Lei nº 6.015/1973 e os arts. 30 a 40 do Decreto-Lei nº 167/1967). Hoje ela pode até ser escritural, em sistema autorizado pelo Banco Central.",
        source:
          "Lei nº 13.986/2020, art. 61; Decreto-Lei nº 167/1967, art. 10-A",
      },
      {
        step: 'Registre só as garantias reais: a hipoteca cedular como R na matrícula do imóvel (Livro 2); o penhor rural, se houver, aqui no Livro 3 (escolha "Contrato de penhor rural"). Cédula só hipotecária não abre registro no Livro 3.',
        source:
          "Decreto-Lei nº 167/1967, arts. 23 e 24; Lei nº 6.015/1973, arts. 167, I, 2 e 15, e 178, VI",
      },
    ],
  },
  {
    match: /^c[eé]dula de cr[eé]dito industrial/i,
    roles: ["emitente", "credor", "avalista", "interveniente", "outro"],
    money: true,
    goods: true,
    pacto: false,
    howTo: [
      {
        step: "Registre a cédula no Livro 3, com emitente, credor, valor, vencimento e os bens em garantia.",
        source:
          "Lei nº 6.015/1973, arts. 167, I, 14, e 178, II; Decreto-Lei nº 413/1969",
      },
      {
        step: "Se houver hipoteca cedular, registre a hipoteca na matrícula do imóvel (Livro 2), com remissão recíproca a este registro.",
        source:
          "Lei nº 6.015/1973, art. 178, II (sem prejuízo do registro da hipoteca cedular)",
      },
      {
        step: "Aditivos e quitação se averbam à margem deste registro (AV).",
        source: "Lei nº 6.015/1973, art. 250",
      },
    ],
  },
  {
    match: /^penhor de m[aá]quinas/i,
    roles: ["devedor", "credor", "interveniente", "depositario", "outro"],
    money: true,
    goods: true,
    pacto: false,
    howTo: [
      {
        step: "Confira se as máquinas e aparelhos estão instalados e em funcionamento nesta circunscrição.",
        source: "Lei nº 6.015/1973, art. 178, IV; Código Civil, art. 1.448",
      },
      {
        step: "Registre o penhor no Livro 3, com a descrição de cada bem e o lugar onde está.",
        source: "Código Civil, art. 1.448",
      },
    ],
  },
  {
    match: /^conven[cç][aã]o antenupcial|pacto antenupcial/i,
    roles: ["conjuge", "outro"],
    money: false,
    goods: false,
    pacto: true,
    howTo: [
      {
        step: "Confira que o pacto foi feito por escritura pública e peça a certidão de casamento: sem escritura é nulo, e sem o casamento não tem efeito.",
        source: "Código Civil, art. 1.653",
      },
      {
        step: "Registre no Livro 3 do Registro de Imóveis do domicílio do casal, com os cônjuges, o regime de bens, a escritura (tabelionato, livro e folhas) e a data do casamento.",
        source:
          "Lei nº 6.015/1973, arts. 178, V, e 244; Código Civil, art. 1.657",
      },
      {
        step: "Averbe o pacto nas matrículas dos imóveis do casal (e nos adquiridos depois), com remissão a este registro.",
        source: "Lei nº 6.015/1973, arts. 167, II, 1, e 244",
      },
    ],
  },
  {
    match: /^conven[cç][aã]o de condom[ií]nio/i,
    roles: ["condominio", "requerente", "outro"],
    money: false,
    goods: false,
    pacto: false,
    howTo: [
      {
        step: "Confira as assinaturas de titulares de, no mínimo, dois terços das frações ideais.",
        source: "Código Civil, art. 1.333",
      },
      {
        step: "Registre a convenção no Livro 3; só assim ela vale contra terceiros.",
        source:
          "Lei nº 6.015/1973, arts. 167, I, 17, e 178, III; Código Civil, art. 1.333, parágrafo único",
      },
      {
        step: "Faça a remissão na matrícula do condomínio (matrícula-mãe) e nas das unidades, quando houver.",
        source: "Lei nº 6.015/1973, art. 178, III",
      },
    ],
  },
  {
    match: /^emiss[aã]o de deb[eê]ntures/i,
    roles: ["emissora", "agente", "outro"],
    money: true,
    goods: true,
    pacto: false,
    howTo: [
      {
        step: "Registre a emissão no Livro 3, com a hipoteca, anticrese ou penhor que a garantem; a prioridade é a ordem do registro.",
        source: "Lei nº 6.015/1973, art. 178, I",
      },
      {
        step: "A hipoteca sobre imóvel também vai como R na matrícula, com remissão recíproca.",
        source: "Lei nº 6.015/1973, art. 167, I, 2",
      },
    ],
  },
  {
    match: /^institui[cç][aã]o de bem de fam[ií]lia/i,
    roles: ["requerente", "conjuge", "outro"],
    money: false,
    goods: false,
    pacto: false,
    howTo: [
      {
        step: "Transcreva a escritura de instituição no Livro 3 e faça a inscrição na matrícula do imóvel.",
        source: "Lei nº 6.015/1973, art. 263",
      },
    ],
  },
  {
    match: /^t[ií]tulo registrado no inteiro teor/i,
    roles: ["requerente", "outro"],
    money: false,
    goods: false,
    pacto: false,
    howTo: [
      {
        step: "Só a requerimento do interessado: registre o título no inteiro teor, sem prejuízo do ato no Livro 2.",
        source: "Lei nº 6.015/1973, art. 178, VII",
      },
    ],
  },
];

const OTHER: AuxGuide = {
  match: /.*/,
  roles: ["emitente", "devedor", "credor", "requerente", "outro"],
  money: true,
  goods: true,
  pacto: false,
  howTo: [
    {
      step: "Confira se o ato é mesmo do Livro 3: só o que a lei manda e que não diz respeito diretamente a imóvel matriculado.",
      source: "Lei nº 6.015/1973, arts. 177 e 178",
    },
  ],
};

export function auxGuideFor(kind: string): AuxGuide {
  return AUX_GUIDES.find((g) => g.match.test(kind.trim())) ?? OTHER;
}

const ROLES = Object.keys(AUX_ROLE_LABELS) as AuxRole[];

const clean = (value: unknown, max = 300) =>
  String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, max);

/** "1.234,56", "R$ 10" → cents; null when empty or not money. */
function cents(value: unknown): number | null {
  const v = String(value ?? "").replace(/[^\d,.-]/g, "");
  if (!v) return null;
  const n = v.includes(",")
    ? Number(v.replace(/\./g, "").replace(",", "."))
    : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

/** The Livro 3 part of the form (`aux.*` fields), checked. */
export function readAux(raw: Record<string, unknown>): AuxData {
  const parties: AuxParty[] = [];
  for (let i = 0; i < 20; i++) {
    const name = clean(raw[`aux.party.${i}.name`]).replace(/\s+/g, " ");
    if (name.length < 2) continue;
    const roleRaw = String(raw[`aux.party.${i}.role`] ?? "");
    parties.push({
      name,
      document: clean(raw[`aux.party.${i}.document`], 30)
        .replace(/\D/g, "")
        .slice(0, 14),
      role: ROLES.find((r) => r === roleRaw) ?? "outro",
    });
  }
  return {
    title: clean(raw["aux.title"]),
    issuedOn: isoDate(raw["aux.issuedOn"]),
    valueCents: cents(raw["aux.value"]),
    dueOn: isoDate(raw["aux.dueOn"]),
    paymentPlace: clean(raw["aux.paymentPlace"], 120),
    terms: clean(raw["aux.terms"], 2000),
    guarantees: clean(raw["aux.guarantees"], 5000),
    goodsPlace: clean(raw["aux.goodsPlace"], 1000),
    regime: clean(raw["aux.regime"], 200),
    weddingOn: isoDate(raw["aux.weddingOn"]),
    domicile: clean(raw["aux.domicile"], 300),
    deed: clean(raw["aux.deed"], 500),
    protocolNumber: clean(raw["aux.protocolNumber"], 30),
    protocolOn: isoDate(raw["aux.protocolOn"]),
    parties,
    annotations: [],
  };
}

/** The anotações as stored, checked one by one. */
export function notesOf(value: unknown): AuxNote[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 500).flatMap((item, i): AuxNote[] => {
    if (!item || typeof item !== "object") return [];
    const n = item as Record<string, unknown>;
    const text = clean(n.text, 5000);
    if (!text) return [];
    const history = Array.isArray(n.history)
      ? n.history.flatMap((h) =>
          h && typeof h === "object"
            ? [
                {
                  at: clean((h as Record<string, unknown>).at, 40),
                  by: clean((h as Record<string, unknown>).by, 80),
                  text: clean((h as Record<string, unknown>).text, 5000),
                  on: isoDate((h as Record<string, unknown>).on),
                },
              ]
            : [],
        )
      : [];
    return [
      {
        id: clean(n.id, 60) || `a${i + 1}`,
        on: isoDate(n.on),
        text,
        at: clean(n.at, 40),
        by: clean(n.by, 80),
        deletedAt: n.deletedAt ? clean(n.deletedAt, 40) : null,
        history,
      },
    ];
  });
}

/** A stored value (jsonb) back into AuxData, whatever it holds. */
export function auxOf(value: unknown): AuxData {
  if (!value || typeof value !== "object") return { ...EMPTY_AUX, parties: [] };
  const v = value as Record<string, unknown>;
  const raw: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(v)) {
    if (key === "parties" || key === "valueCents" || key === "annotations")
      continue;
    raw[`aux.${key}`] = item;
  }
  const parties = Array.isArray(v.parties) ? v.parties : [];
  parties.forEach((p, i) => {
    if (!p || typeof p !== "object") return;
    const party = p as Record<string, unknown>;
    raw[`aux.party.${i}.name`] = party.name;
    raw[`aux.party.${i}.document`] = party.document;
    raw[`aux.party.${i}.role`] = party.role;
  });
  const out = readAux(raw);
  out.annotations = notesOf(v.annotations);
  const stored = Number(v.valueCents);
  out.valueCents =
    v.valueCents === null ||
    v.valueCents === undefined ||
    !Number.isFinite(stored)
      ? null
      : Math.round(stored);
  return out;
}

const money = (c: number) =>
  (c / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const doc = (d: string) =>
  d.length === 11
    ? `CPF ${d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}`
    : d.length === 14
      ? `CNPJ ${d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}`
      : "";

/**
 * The text of the registro as the Livro 3 writes it (the shape of the
 * models the registradores use): TÍTULO, the parties, VALOR, VENCIMENTO,
 * GARANTIAS, PROTOCOLO.
 */
export function auxText(kind: string, aux: AuxData, linked: string): string[] {
  const lines: string[] = [];
  const title = [
    aux.title || kind,
    aux.issuedOn ? `emitido em ${brDate(aux.issuedOn)}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  if (title) lines.push(`TÍTULO: ${title}.`);
  const byRole = new Map<AuxRole, AuxParty[]>();
  for (const p of aux.parties) {
    byRole.set(p.role, [...(byRole.get(p.role) ?? []), p]);
  }
  for (const [role, list] of byRole) {
    lines.push(
      `${AUX_ROLE_LABELS[role].toUpperCase()}: ${list
        .map((p) => [p.name, doc(p.document)].filter(Boolean).join(", "))
        .join("; ")}.`,
    );
  }
  if (aux.regime) lines.push(`REGIME DE BENS: ${aux.regime}.`);
  if (aux.weddingOn) lines.push(`CASAMENTO: ${brDate(aux.weddingOn)}.`);
  if (aux.domicile) lines.push(`DOMICÍLIO DO CASAL: ${aux.domicile}.`);
  if (aux.deed) lines.push(`ESCRITURA: ${aux.deed}.`);
  if (aux.valueCents !== null) lines.push(`VALOR: ${money(aux.valueCents)}.`);
  if (aux.dueOn) lines.push(`VENCIMENTO: ${brDate(aux.dueOn)}.`);
  if (aux.paymentPlace) lines.push(`PRAÇA DE PAGAMENTO: ${aux.paymentPlace}.`);
  if (aux.terms) lines.push(`FORMA DE PAGAMENTO E ENCARGOS: ${aux.terms}`);
  if (aux.guarantees) lines.push(`GARANTIAS: ${aux.guarantees}`);
  if (aux.goodsPlace) lines.push(`LOCAL DOS BENS: ${aux.goodsPlace}`);
  if (linked) lines.push(`MATRÍCULA(S) RELACIONADA(S): ${linked}.`);
  const live = aux.annotations.filter((n) => !n.deletedAt);
  if (live.length > 0) {
    lines.push(
      `ANOTAÇÕES: ${live.map((n) => `${n.on ? `${brDate(n.on)}: ` : ""}${n.text}`).join(" ")}`,
    );
  }
  if (aux.protocolNumber) {
    lines.push(
      `PROTOCOLO: título apontado sob nº ${aux.protocolNumber}${aux.protocolOn ? `, em ${brDate(aux.protocolOn)}` : ""}.`,
    );
  }
  return lines;
}

/**
 * What a reading brings to a registro already saved: only the empty
 * fields are filled; a value the office typed is never replaced. Parties
 * come in only when there are none.
 */
export function mergeAux(current: AuxData, incoming: AuxData): AuxData {
  const out: AuxData = { ...current, parties: [...current.parties] };
  const empty = (v: unknown) =>
    v === null ||
    v === undefined ||
    v === "" ||
    (Array.isArray(v) && v.length === 0);
  for (const key of Object.keys(out) as (keyof AuxData)[]) {
    if (empty(current[key]) && !empty(incoming[key])) {
      (out as unknown as Record<string, unknown>)[key] = incoming[key];
    }
  }
  return out;
}
