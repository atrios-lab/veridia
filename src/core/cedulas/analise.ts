import { z } from "zod";
import {
  CEDULA_KINDS,
  type CedulaFamily,
  type CedulaKind,
  deadlineText,
  GUARANTEE_KINDS,
  type GuaranteeKind,
  KIND_INFO,
} from "./especies.ts";

/**
 * The analysis of a cédula (decision of 21/11/2026): the data read from
 * the cédula and its aditivos, checked by the clerk, and what the
 * Registro de Imóveis does with them. `planActs` and `planAddendum` are
 * pure: the assistente virtual only fills the data; the acts always come
 * from the rules in especies.ts, so it never invents a book or an act.
 */

const text = (max = 2000) => z.string().trim().max(max).default("");

export const PERSON_ROLES = [
  "emitente",
  "credor",
  "avalista",
  "interveniente",
  "fiel-depositario",
  "conjuge",
] as const;
export type PersonRole = (typeof PERSON_ROLES)[number];

export const PERSON_ROLE_LABELS: Record<PersonRole, string> = {
  emitente: "Emitente",
  credor: "Credor",
  avalista: "Avalista",
  interveniente: "Interveniente garantidor",
  "fiel-depositario": "Fiel depositário",
  conjuge: "Cônjuge",
};

export const PersonSchema = z.object({
  role: z.enum(PERSON_ROLES),
  name: text(200),
  taxId: text(30),
  /** Nacionalidade, estado civil, profissão, endereço, as in the title. */
  qualification: text(1000),
});
export type CedulaPerson = z.infer<typeof PersonSchema>;

/** Whether the bem is in this office's circunscrição. */
export const HERE_OPTIONS = ["sim", "nao", "nao-sei"] as const;
export type Here = (typeof HERE_OPTIONS)[number];

export const GuaranteeSchema = z.object({
  kind: z.enum(GUARANTEE_KINDS),
  /** "1º", "2º"... */
  grade: text(20),
  description: text(3000),
  /** Matrícula (and the registro of ownership), when on an imóvel. */
  registration: text(300),
  /** Where the bens are (the imóvel of localização, for a penhor). */
  location: text(500),
  municipality: text(120),
  here: z.enum(HERE_OPTIONS).default("nao-sei"),
  owner: text(300),
});
export type CedulaGuarantee = z.infer<typeof GuaranteeSchema>;

// ------------------------------------------------------------- aditivos

export const CHANGE_KINDS = [
  "prazo",
  "valor-aumento",
  "valor-reducao",
  "encargos",
  "garantia-inclusao",
  "garantia-substituicao",
  "garantia-liberacao",
  "partes",
  "rerratificacao",
  "outro",
] as const;
export type ChangeKind = (typeof CHANGE_KINDS)[number];

export const CHANGE_LABELS: Record<ChangeKind, string> = {
  prazo: "Prazo ou vencimento (prorrogação)",
  "valor-aumento": "Valor aumentado (crédito suplementar)",
  "valor-reducao": "Valor reduzido",
  encargos: "Juros, encargos ou forma de pagamento",
  "garantia-inclusao": "Inclusão de bem ou garantia nova",
  "garantia-substituicao": "Substituição de garantia",
  "garantia-liberacao": "Liberação de garantia (total ou parcial)",
  partes: "Partes (emitente, credor, interveniente)",
  rerratificacao: "Retificação ou ratificação de erro",
  outro: "Outra alteração",
};

export const AddendumSchema = z.object({
  /** "1º termo aditivo", as in the paper. */
  title: text(200),
  date: text(40),
  changes: z.array(z.enum(CHANGE_KINDS)).max(CHANGE_KINDS.length).default([]),
  previousDue: text(80),
  newDue: text(80),
  previousAmount: text(80),
  newAmount: text(80),
  /** What was included, substituted or released, in the paper's words. */
  guaranteeChange: text(3000),
  /** Every other change, in the paper's words. */
  description: text(3000),
});
export type CedulaAddendum = z.infer<typeof AddendumSchema>;

// ------------------------------------------------------------ the data

export const CedulaDataSchema = z.object({
  kind: z.enum(CEDULA_KINDS),
  /** The title as printed: "CÉDULA RURAL HIPOTECÁRIA Nº 40/00123-7". */
  title: text(300),
  number: text(80),
  issuedOn: text(40),
  issuePlace: text(120),
  amount: text(80),
  dueOn: text(80),
  paymentPlace: text(120),
  paymentTerms: text(2000),
  charges: text(1000),
  /** CPR: the product, quantity and characteristics. */
  product: text(2000),
  /** CCI: série and instituição custodiante (Lei 10.931, art. 18, § 5º). */
  series: text(80),
  custodian: text(200),
  /** CCB used for crédito rural (Lei 10.931, art. 42-B). */
  ruralCredit: z.boolean().default(false),
  people: z.array(PersonSchema).max(40).default([]),
  guarantees: z.array(GuaranteeSchema).max(40).default([]),
  addenda: z.array(AddendumSchema).max(30).default([]),
  protocolNumber: text(40),
  protocolDate: text(40),
  notes: text(5000),
});
export type CedulaData = z.infer<typeof CedulaDataSchema>;

export const emptyCedula = (kind: CedulaKind): CedulaData =>
  CedulaDataSchema.parse({ kind });

// ------------------------------------------------------- charging basis

/**
 * How the act is charged (decision of 21/11/2026: "existem maneiras
 * diferentes de cobrar"). The amount itself is the State's table; this
 * says which kind of act it is, with the federal rule.
 */
export const CHARGE_BASES = [
  "valor-credito",
  "valor-suplementar",
  "conteudo-financeiro",
  "sem-conteudo",
  "nenhum",
] as const;
export type ChargeBasis = (typeof CHARGE_BASES)[number];

export const CHARGE_LABELS: Record<ChargeBasis, string> = {
  "valor-credito": "Com valor: base no valor do crédito garantido",
  "valor-suplementar": "Com valor: base no crédito suplementar do aditivo",
  "conteudo-financeiro": "Com conteúdo financeiro (faixa da tabela)",
  "sem-conteudo": "Sem conteúdo econômico (valor fixo da tabela)",
  nenhum: "Sem ato a cobrar nesta serventia",
};

const RURAL_CAP =
  "Crédito rural: os emolumentos da garantia não passam de 0,3% do valor do crédito, incluída a taxa de fiscalização, nem do valor da tabela estadual (Lei nº 10.169/2000, art. 2º, § 2º, I e II).";

/** Whether the federal ceiling of the crédito rural applies. */
export function isRuralCredit(data: CedulaData): boolean {
  const family = KIND_INFO[data.kind].family;
  return (
    family === "rural" ||
    family === "cpr" ||
    (family === "ccb" && data.ruralCredit)
  );
}

// ------------------------------------------------------------ the plan

export type ActWhere =
  | "livro-3"
  | "matricula"
  | "rtd"
  | "entidade-registradora"
  | "outro-orgao"
  | "nenhum";

export const ACT_WHERE_LABELS: Record<ActWhere, string> = {
  "livro-3": "Livro nº 3, Registro Auxiliar",
  matricula: "Matrícula (Livro nº 2, Registro Geral)",
  rtd: "Registro de Títulos e Documentos",
  "entidade-registradora": "Entidade autorizada pelo Banco Central",
  "outro-orgao": "Outro órgão",
  nenhum: "Sem ato",
};

/** The kinds of model a planned act turns into (minutas.ts). */
export type ModelKind =
  | "cedula-livro-3"
  | "penhor-livro-3"
  | "hipoteca-matricula"
  | "af-imovel-matricula"
  | "af-produto-livro-3"
  | "afetacao-matricula"
  | "averbacao-emissao-cci"
  | "averbacao-localizacao-penhor"
  | "remissao"
  | "aditivo"
  | "aditivo-garantia-nova";

export interface PlannedAct {
  id: string;
  /** "Registro", "Averbação", "Remissão", "Comunicação". */
  nature: "registro" | "averbacao" | "remissao" | "fora";
  where: ActWhere;
  title: string;
  why: string;
  basis: string;
  charge: ChargeBasis;
  /** Done only at the request of the party. */
  optional: boolean;
  /** Belongs to another office or registry: shown, no model. */
  elsewhere: boolean;
  model?: ModelKind;
  guaranteeIndex?: number;
  addendumIndex?: number;
}

export interface Plan {
  kind: CedulaKind;
  family: CedulaFamily;
  cedulaAct: string;
  cedulaBasis: string;
  acts: PlannedAct[];
  deadline: string;
  deadlineBasis: string;
  warnings: string[];
  rules: string[];
  divergence?: string;
  toConfirm?: string;
}

const LRP = "Lei nº 6.015/1973";

const elsewhereNote = (g: CedulaGuarantee) =>
  g.here === "nao"
    ? ` Este bem fica fora desta circunscrição${g.municipality ? ` (${g.municipality})` : ""}: o ato cabe ao Registro de Imóveis de lá.`
    : "";

function guaranteeActs(
  data: CedulaData,
  g: CedulaGuarantee,
  index: number,
): PlannedAct[] {
  const family = KIND_INFO[data.kind].family;
  const elsewhere = g.here === "nao";
  const base = {
    guaranteeIndex: index,
    elsewhere,
    optional: false,
  };
  const charge: ChargeBasis = elsewhere ? "nenhum" : "valor-credito";
  const id = (suffix: string) => `g${index}-${suffix}`;

  switch (g.kind) {
    case "pessoal":
      return [];
    case "hipoteca":
      if (family === "cci") return [];
      return [
        {
          ...base,
          id: id("hipoteca"),
          nature: "registro",
          where: "matricula",
          title: `Registro da hipoteca cedular${g.registration ? ` na ${g.registration}` : " na matrícula do imóvel"}`,
          why: `A hipoteca constituída pela cédula é registrada na matrícula do imóvel hipotecado.${elsewhereNote(g)}`,
          basis: `${LRP}, art. 167, I, item 2${family === "industrial" ? ", e art. 178, II (sem prejuízo do registro da cédula no Livro nº 3)" : ""}${family === "cpr" ? "; Lei nº 8.929/1994, art. 12, § 1º" : ""}.`,
          charge,
          model: "hipoteca-matricula",
        },
      ];
    case "af-imovel":
      if (family === "cci") return [];
      return [
        {
          ...base,
          id: id("af-imovel"),
          nature: "registro",
          where: "matricula",
          title: `Registro da alienação fiduciária${g.registration ? ` na ${g.registration}` : " na matrícula do imóvel"}`,
          why: `A alienação fiduciária de imóvel é registrada na matrícula.${elsewhereNote(g)}`,
          basis: `${LRP}, art. 167, I, item 35${family === "cpr" ? "; Lei nº 8.929/1994, art. 12, § 1º" : ""}.`,
          charge,
          model: "af-imovel-matricula",
        },
      ];
    case "afetacao":
      return [
        {
          ...base,
          id: id("afetacao"),
          nature: "registro",
          where: "matricula",
          title: "Registro do patrimônio rural em afetação",
          why: `O patrimônio rural em afetação é constituído por registro na matrícula, a requerimento do proprietário.${elsewhereNote(g)}`,
          basis: `Lei nº 13.986/2020, art. 9º; ${LRP}, art. 167, I, item 47.`,
          charge,
          model: "afetacao-matricula",
        },
      ];
    case "penhor": {
      // In the industrial family the penhor is part of the cédula's own
      // inscription in the Livro nº 3 (DL 413/1969, art. 30).
      const own: PlannedAct[] =
        family === "industrial"
          ? []
          : family === "ccb"
            ? [
                {
                  ...base,
                  id: id("penhor"),
                  nature: "registro",
                  where: "livro-3",
                  title:
                    "Registro do penhor no Livro nº 3 (penhor rural, industrial ou mercantil)",
                  why: `Penhor rural, industrial ou mercantil é registrado no Registro de Imóveis onde estão os bens; o penhor comum vai ao Títulos e Documentos.${elsewhereNote(g)}`,
                  basis: `Código Civil, arts. 1.438 e 1.448; ${LRP}, art. 178, VI; Lei nº 10.931/2004, art. 42.`,
                  charge,
                  model: "penhor-livro-3",
                },
              ]
            : [
                {
                  ...base,
                  id: id("penhor"),
                  nature: "registro",
                  where: "livro-3",
                  title: "Registro do penhor rural no Livro nº 3",
                  why: `O penhor rural é registrado no Registro de Imóveis da circunscrição onde estão os bens apenhados.${elsewhereNote(g)}`,
                  basis: `Código Civil, art. 1.438; ${LRP}, arts. 167, I, item 15, e 178, VI${family === "cpr" ? "; Lei nº 8.929/1994, art. 12, § 1º" : ""}.`,
                  charge,
                  model: "penhor-livro-3",
                },
              ];
      const location: PlannedAct[] =
        g.location && !elsewhere
          ? [
              {
                ...base,
                id: id("localizacao"),
                nature: "averbacao",
                where: "matricula",
                title:
                  "Averbação, na matrícula do imóvel de localização, da existência do penhor",
                why: "Facultativa, a requerimento do interessado: dá notícia, na matrícula, dos bens apenhados que estão no imóvel.",
                basis: `${LRP}, art. 246; Caderno IRIB nº 9, item 7.`,
                charge: "sem-conteudo",
                optional: true,
                model: "averbacao-localizacao-penhor",
              },
            ]
          : [];
      return [...own, ...location];
    }
    case "af-movel":
      return [
        {
          ...base,
          id: id("af-movel"),
          nature: "fora",
          where: "rtd",
          title: "Alienação fiduciária de bem móvel: Títulos e Documentos",
          why:
            family === "industrial"
              ? "Na cédula industrial, à exportação ou comercial, ela entra no registro da cédula no Livro nº 3; para valer contra terceiros, recomenda-se também o Títulos e Documentos do domicílio do devedor. Veículo: órgão de trânsito."
              : "A alienação fiduciária de bem móvel é registrada no Títulos e Documentos do domicílio do devedor. Veículo: órgão de trânsito.",
          basis: `${LRP}, art. 129, 5º; Código Civil, art. 1.361, § 1º.`,
          charge: "nenhum",
          optional: false,
          elsewhere: true,
        },
      ];
    case "af-produto":
      return [
        {
          ...base,
          id: id("af-produto"),
          nature: "registro",
          where: "livro-3",
          title:
            "Registro da alienação fiduciária de produtos agropecuários no Livro nº 3",
          why: `A alienação fiduciária de produtos agropecuários da CPR é registrada no Registro de Imóveis onde estão os bens.${elsewhereNote(g)}`,
          basis: "Lei nº 8.929/1994, arts. 8º e 12, § 4º.",
          charge,
          model: "af-produto-livro-3",
        },
      ];
  }
}

/** The acts the cédula itself asks for, before its guarantees. */
function cedulaActs(data: CedulaData): PlannedAct[] {
  const info = KIND_INFO[data.kind];
  const here = data.guarantees.some((g) => g.here !== "nao");
  switch (info.cedulaAct.where) {
    case "livro-3":
      return [
        {
          id: "cedula",
          nature: "registro",
          where: "livro-3",
          title: `Registro da ${info.label} no Livro nº 3`,
          why: info.cedulaAct.text,
          basis: info.cedulaAct.basis,
          charge: "valor-credito",
          optional: false,
          elsewhere: !here && data.guarantees.length > 0,
          model: "cedula-livro-3",
        },
      ];
    case "averbacao-matricula":
      return data.guarantees.flatMap((g, index) =>
        g.kind === "hipoteca" || g.kind === "af-imovel"
          ? [
              {
                id: `g${index}-cci`,
                nature: "averbacao" as const,
                where: "matricula" as const,
                title: `Averbação da emissão da CCI${g.registration ? ` na ${g.registration}` : " na matrícula"}`,
                why: `${info.cedulaAct.text}${elsewhereNote(g)}`,
                basis: info.cedulaAct.basis,
                // Ato único com o registro da garantia (art. 18, § 6º).
                charge: "valor-credito" as const,
                optional: false,
                elsewhere: g.here === "nao",
                model: "averbacao-emissao-cci" as const,
                guaranteeIndex: index,
              },
            ]
          : [],
      );
    case "entidade-registradora":
      return [
        {
          id: "cedula",
          nature: "fora",
          where: "entidade-registradora",
          title: "Registro ou depósito da cédula em entidade autorizada",
          why: info.cedulaAct.text,
          basis: info.cedulaAct.basis,
          charge: "nenhum",
          optional: false,
          elsewhere: true,
        },
      ];
    case "nenhum":
      return [];
  }
}

/** The remissão between the Livro nº 3 and each matrícula. */
function remissionActs(acts: PlannedAct[]): PlannedAct[] {
  const book = acts.find((a) => a.where === "livro-3" && !a.elsewhere);
  const onMatricula = acts.filter(
    (a) => a.where === "matricula" && a.nature === "registro" && !a.elsewhere,
  );
  if (!book || onMatricula.length === 0) return [];
  return [
    {
      id: "remissao",
      nature: "remissao",
      where: "livro-3",
      title: "Remissões entre o Livro nº 3 e a matrícula",
      why: "Cada registro faz referência ao outro, para quem consultar um chegar ao outro.",
      basis: `${LRP}, arts. 176 (matrícula) e 178 (Livro nº 3).`,
      charge: "sem-conteudo",
      optional: false,
      elsewhere: false,
      model: "remissao",
    },
  ];
}

/** Planned acts for one aditivo (decision of 21/11/2026). */
export function planAddendum(
  data: CedulaData,
  addendum: CedulaAddendum,
  index: number,
): PlannedAct[] {
  const family = KIND_INFO[data.kind].family;
  const rural = isRuralCredit(data);
  const changes = new Set(addendum.changes);
  const acts: PlannedAct[] = [];
  const name = addendum.title || `${index + 1}º aditivo`;

  if (family === "cpr" || family === "cir") {
    acts.push({
      id: `a${index}-entidade`,
      nature: "fora",
      where: "entidade-registradora",
      title: `${name}: registro do aditamento na entidade autorizada`,
      why: "O aditamento segue o título: registrado ou depositado na entidade autorizada pelo Banco Central, nos mesmos prazos.",
      basis:
        family === "cpr"
          ? "Lei nº 8.929/1994, art. 12, caput, e art. 3º, § 5º."
          : "Lei nº 13.986/2020, art. 19.",
      charge: "nenhum",
      optional: false,
      elsewhere: true,
      addendumIndex: index,
    });
  }

  // A new or substituted bem asks for its own registro, besides the
  // averbação (DL 413/1969, art. 50, § 2º; LRP, art. 167, I).
  if (
    changes.has("garantia-inclusao") ||
    changes.has("garantia-substituicao")
  ) {
    acts.push({
      id: `a${index}-garantia`,
      nature: "registro",
      where: "matricula",
      title: `${name}: registro da garantia nova`,
      why: "Bem novo vinculado à cédula é registro, e não só averbação: registra-se a garantia nova (na matrícula, se imóvel; no Livro nº 3, se penhor) e averba-se o aditivo no registro anterior.",
      basis:
        family === "industrial"
          ? "Decreto-Lei nº 413/1969, art. 50, § 2º; Lei nº 6.015/1973, art. 167, I."
          : "Lei nº 6.015/1973, art. 167, I (itens 2, 15 e 35, conforme a garantia).",
      charge: rural ? "valor-credito" : "conteudo-financeiro",
      optional: false,
      elsewhere: false,
      model: "aditivo-garantia-nova",
      addendumIndex: index,
    });
  }

  const suplementar = changes.has("valor-aumento");
  const charge: ChargeBasis = suplementar
    ? rural
      ? "valor-suplementar"
      : "conteudo-financeiro"
    : "sem-conteudo";
  const chargeBasis = suplementar
    ? rural
      ? "Lei nº 10.169/2000, art. 2º, § 2º, II, b: base de cálculo no crédito suplementar."
      : "Lei nº 10.169/2000, art. 2º, III, b."
    : rural
      ? "Lei nº 10.169/2000, art. 2º, § 2º, II, c: sem mudança no valor do crédito, ato sem conteúdo econômico."
      : "Lei nº 10.169/2000, art. 2º, III, a.";
  const prazoOnly =
    changes.size > 0 && [...changes].every((c) => c === "prazo");
  const ruralProrogation = family === "rural" && prazoOnly;
  acts.push({
    id: `a${index}-averbacao`,
    nature: "averbacao",
    where:
      KIND_INFO[data.kind].cedulaAct.where === "livro-3"
        ? "livro-3"
        : "matricula",
    title: `${name}: averbação do aditivo${changes.has("garantia-liberacao") ? " (liberação de garantia)" : ""}`,
    why: [
      family === "industrial"
        ? "Aditivos, menções adicionais e qualquer ato que altere a garantia ou as condições são averbados à margem da inscrição da cédula."
        : "O aditivo que altera o registro da garantia é averbado na matrícula ou no registro do penhor.",
      ruralProrogation
        ? "Prorrogação de cédula rural: a lei dispensa o aditivo e a assinatura do emitente, bastando a anotação do credor no título; a averbação, se pedida, é ato sem conteúdo econômico."
        : "",
      changes.has("garantia-liberacao")
        ? "Liberação de garantia é cancelamento (total ou parcial), no prazo de 5 dias."
        : "",
    ]
      .filter(Boolean)
      .join(" "),
    basis: [
      family === "industrial"
        ? "Decreto-Lei nº 413/1969, arts. 12 e 36."
        : family === "rural"
          ? "Decreto-Lei nº 167/1967, art. 12; Lei nº 6.015/1973, art. 246."
          : family === "cpr"
            ? "Lei nº 8.929/1994, art. 9º; Lei nº 6.015/1973, art. 246."
            : "Lei nº 6.015/1973, art. 246.",
      ruralProrogation ? "Decreto-Lei nº 167/1967, art. 62." : "",
      changes.has("garantia-liberacao")
        ? "Lei nº 6.015/1973, arts. 167, II, item 2, 188, § 1º, I, e 250."
        : "",
      chargeBasis,
    ]
      .filter(Boolean)
      .join(" "),
    charge,
    optional: ruralProrogation,
    elsewhere: false,
    model: "aditivo",
    addendumIndex: index,
  });
  return acts;
}

/** What changed, read from the before and after the clerk typed. */
export function inferChanges(addendum: CedulaAddendum): ChangeKind[] {
  const found = new Set(addendum.changes);
  const before = moneyCents(addendum.previousAmount);
  const after = moneyCents(addendum.newAmount);
  if (before !== null && after !== null) {
    if (after > before) found.add("valor-aumento");
    if (after < before) found.add("valor-reducao");
  }
  const due = (v: string) => v.replace(/\s+/g, "").toLowerCase();
  if (
    addendum.previousDue &&
    addendum.newDue &&
    due(addendum.previousDue) !== due(addendum.newDue)
  ) {
    found.add("prazo");
  }
  return CHANGE_KINDS.filter((c) => found.has(c));
}

/** "R$ 1.234,56" to 123456; null when it is not a sum of money. */
export function moneyCents(value: string): number | null {
  const match = /(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?/.exec(
    value.replace(/\s/g, ""),
  );
  if (!match?.[1]) return null;
  const whole = Number(match[1].replace(/\./g, ""));
  const cents = Number((match[2] ?? "0").padEnd(2, "0"));
  return Number.isFinite(whole) ? whole * 100 + cents : null;
}

export function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** The whole plan: the cédula, each guarantee, the remissões, the aditivos. */
export function planActs(data: CedulaData): Plan {
  const info = KIND_INFO[data.kind];
  const base = [
    ...cedulaActs(data),
    ...data.guarantees.flatMap((g, i) => guaranteeActs(data, g, i)),
  ];
  const acts = [
    ...base,
    ...remissionActs(base),
    ...data.addenda.flatMap((a, i) => planAddendum(data, a, i)),
  ];

  const warnings: string[] = [];
  const real = data.guarantees.filter((g) => g.kind !== "pessoal");
  if (info.family === "rural" && data.kind !== "nota-credito-rural") {
    if (real.length === 0) {
      warnings.push(
        "Nenhuma garantia real informada: sem garantia real, a cédula rural não tem ato no Registro de Imóveis.",
      );
    }
  }
  if (
    info.family === "cci" &&
    !real.some((g) => g.kind === "hipoteca" || g.kind === "af-imovel")
  ) {
    warnings.push(
      "A CCI só é averbada quando o crédito tem garantia real sobre imóvel já registrada: informe a hipoteca ou a alienação fiduciária.",
    );
  }
  if (info.family === "cci" && (!data.series || !data.custodian)) {
    warnings.push(
      "Na averbação da CCI devem constar o número, a série e a instituição custodiante: preencha os que faltam.",
    );
  }
  if (
    data.kind === "rural-hipotecaria" &&
    !real.some((g) => g.kind === "hipoteca")
  ) {
    warnings.push(
      "Cédula rural hipotecária sem hipoteca informada: confira as garantias.",
    );
  }
  if (
    data.kind === "rural-pignoraticia" &&
    !real.some((g) => g.kind === "penhor")
  ) {
    warnings.push(
      "Cédula rural pignoratícia sem penhor informado: confira as garantias.",
    );
  }
  if (real.some((g) => g.here === "nao")) {
    warnings.push(
      "Há bem fora desta circunscrição: os atos dele cabem ao Registro de Imóveis de lá; nesta serventia, só os bens daqui.",
    );
  }
  if (real.some((g) => g.here === "nao-sei")) {
    warnings.push(
      "Confirme, em cada garantia, se o bem fica nesta circunscrição: a competência depende disso.",
    );
  }
  if (!data.protocolNumber) {
    warnings.push(
      "Informe o número e a data do protocolo para contar o prazo.",
    );
  }
  for (const [i, a] of data.addenda.entries()) {
    if (a.changes.length === 0) {
      warnings.push(
        `${a.title || `${i + 1}º aditivo`}: marque o que mudou (prazo, valor, garantia...) para saber se é averbação ou registro e como cobrar.`,
      );
    }
  }

  const rules = [...info.rules];
  if (isRuralCredit(data)) rules.push(RURAL_CAP);

  return {
    kind: data.kind,
    family: info.family,
    cedulaAct: info.cedulaAct.text,
    cedulaBasis: info.cedulaAct.basis,
    acts,
    deadline: deadlineText(info.deadline),
    deadlineBasis: info.deadline.basis,
    warnings,
    rules,
    ...(info.divergence ? { divergence: info.divergence } : {}),
    ...(info.toConfirm ? { toConfirm: info.toConfirm } : {}),
  };
}

// ----------------------------------------------- detection and learning

/** Lowercase, no accents, single spaces. */
export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The words of a cédula's title that say its kind, and nothing else
 * (decision of 21/11/2026: "salvar o que aprendeu", with no personal
 * data): no number, nothing after "nº", only letters.
 */
export function cueOf(title: string): string {
  const head =
    fold(title).split(/\bn\s*[.oº°]?\s*\d|\bno\s*\d|\bnumero\b|\d/)[0] ?? "";
  const words = head
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .slice(0, 10);
  return words.length >= 2 ? words.join(" ") : "";
}

const PATTERNS: [CedulaKind, RegExp][] = [
  [
    "rural-pignoraticia-hipotecaria",
    /cedula (de credito )?rural pignoraticia e hipotecaria/,
  ],
  ["rural-hipotecaria", /cedula (de credito )?rural hipotecaria/],
  ["rural-pignoraticia", /cedula (de credito )?rural pignoraticia/],
  ["nota-credito-rural", /nota de credito rural/],
  ["imobiliaria-rural", /cedula imobiliaria rural/],
  ["produto-rural", /cedula de produto rural|\bcpr\b/],
  ["credito-exportacao", /cedula de credito a exportacao/],
  ["credito-comercial", /cedula de credito comercial/],
  ["credito-industrial", /cedula de credito industrial/],
  ["credito-imobiliario", /cedula de credito imobiliario/],
  ["credito-bancario", /cedula de credito bancario|\bccb\b/],
];

export interface LearnedCue {
  cue: string;
  kind: CedulaKind;
}

export interface Detection {
  kind: CedulaKind;
  by: "aprendido" | "titulo";
  cue: string;
}

/** The kind of a cédula from its text; what the office taught comes first. */
export function detectKind(
  textOrTitle: string,
  learned: LearnedCue[] = [],
): Detection | null {
  const folded = fold(textOrTitle);
  const taught = [...learned]
    .filter((l) => l.cue && folded.includes(l.cue))
    .sort((a, b) => b.cue.length - a.cue.length)[0];
  if (taught) return { kind: taught.kind, by: "aprendido", cue: taught.cue };
  for (const [kind, pattern] of PATTERNS) {
    const match = pattern.exec(folded);
    if (match) return { kind, by: "titulo", cue: match[0] };
  }
  return null;
}

/** The guarantees a text mentions, for the clerk to confirm. */
export function detectGuarantees(textValue: string): GuaranteeKind[] {
  const folded = fold(textValue);
  const found: GuaranteeKind[] = [];
  if (/\bhipoteca/.test(folded)) found.push("hipoteca");
  if (/\bpenhor/.test(folded)) found.push("penhor");
  if (/alienacao fiduciaria/.test(folded)) {
    found.push(/matricula|imovel/.test(folded) ? "af-imovel" : "af-movel");
  }
  if (/patrimonio rural em afetacao/.test(folded)) found.push("afetacao");
  if (/\baval/.test(folded)) found.push("pessoal");
  return found;
}

/** The changes an aditivo's text suggests, for the clerk to confirm. */
export function detectChanges(textValue: string): ChangeKind[] {
  const folded = fold(textValue);
  const found = new Set<ChangeKind>();
  if (
    /prorroga|novo vencimento|vencimento passa|altera(cao|r) (do|o) vencimento/.test(
      folded,
    )
  ) {
    found.add("prazo");
  }
  if (
    /credito suplementar|suplementa|majora|acrescimo do valor|eleva(cao|r) do valor|aumento do (valor|credito)/.test(
      folded,
    )
  ) {
    found.add("valor-aumento");
  }
  if (/reduc(ao|ir) do valor|reduz(ir)? o valor/.test(folded)) {
    found.add("valor-reducao");
  }
  if (/taxa de juros|encargos|forma de pagamento|cronograma/.test(folded)) {
    found.add("encargos");
  }
  if (
    /inclus(ao|ir).{0,40}(garantia|bem|bens)|vincula(cao|m)? de novos bens|reforco de garantia/.test(
      folded,
    )
  ) {
    found.add("garantia-inclusao");
  }
  if (/substitui(cao|r).{0,40}(garantia|bem)/.test(folded)) {
    found.add("garantia-substituicao");
  }
  if (
    /libera(cao|r).{0,40}(garantia|bem|hipoteca|penhor)|desonera/.test(folded)
  ) {
    found.add("garantia-liberacao");
  }
  if (/rerratifica|retifica(cao|r)|ratifica(cao|r)/.test(folded)) {
    found.add("rerratificacao");
  }
  if (
    /assun(cao|ir) (de|da) divida|cessao|substitui(cao|r) (do|de) (emitente|devedor|credor)/.test(
      folded,
    )
  ) {
    found.add("partes");
  }
  return CHANGE_KINDS.filter((c) => found.has(c));
}

/**
 * Data from outside (the assistente virtual, an old row) made valid: an
 * unknown kind falls back, an item that does not fit is dropped, never the
 * whole analysis.
 */
export function coerceCedulaData(
  raw: unknown,
  fallbackKind: CedulaKind,
): CedulaData {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const list = (key: string) =>
    Array.isArray(value[key]) ? (value[key] as unknown[]) : [];
  const keep = <T>(schema: z.ZodType<T>, items: unknown[]): T[] =>
    items.flatMap((item) => {
      const parsed = schema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  const addenda = list("addenda").map((item) => {
    const a = (item && typeof item === "object" ? item : {}) as Record<
      string,
      unknown
    >;
    const changes = Array.isArray(a.changes)
      ? a.changes.filter((c): c is ChangeKind =>
          (CHANGE_KINDS as readonly unknown[]).includes(c),
        )
      : [];
    return { ...a, changes };
  });
  const kind =
    typeof value.kind === "string" &&
    (CEDULA_KINDS as readonly string[]).includes(value.kind)
      ? (value.kind as CedulaKind)
      : fallbackKind;
  const scalars = Object.fromEntries(
    Object.entries(value).filter(
      ([key, v]) =>
        !["people", "guarantees", "addenda", "kind"].includes(key) &&
        (typeof v === "string" || typeof v === "boolean"),
    ),
  );
  const parsed = CedulaDataSchema.safeParse({
    ...scalars,
    kind,
    people: keep(PersonSchema, list("people")),
    guarantees: keep(GuaranteeSchema, list("guarantees")),
    addenda: keep(AddendumSchema, addenda),
  });
  return parsed.success ? parsed.data : emptyCedula(kind);
}
