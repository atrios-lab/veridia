/**
 * The kinds of cédula de crédito and what the Registro de Imóveis does with
 * each (decision of 21/11/2026: "um campo em utilitários de análises de
 * cédulas, para dizer o tabelião qual tipo da cédula, qual livro ela é").
 *
 * The rules follow the laws in force, read in the official compiled texts
 * (planalto.gov.br) on 21/11/2026. The Caderno IRIB nº 9 (2016), the study
 * the office sent, predates the Leis 13.986/2020 and 14.421/2022; where it
 * says otherwise, the kind carries the divergence and the article that
 * changed, so the office sees why.
 *
 * This is code, not a setting: a wrong line here is a wrong act on the
 * books, so every change goes through review, with its basis.
 */

export const CHECKED_ON = "21/11/2026";

export const CEDULA_KINDS = [
  "rural-pignoraticia",
  "rural-hipotecaria",
  "rural-pignoraticia-hipotecaria",
  "nota-credito-rural",
  "credito-industrial",
  "credito-exportacao",
  "credito-comercial",
  "produto-rural",
  "credito-imobiliario",
  "credito-bancario",
  "imobiliaria-rural",
] as const;
export type CedulaKind = (typeof CEDULA_KINDS)[number];
export const isCedulaKind = (value: string): value is CedulaKind =>
  (CEDULA_KINDS as readonly string[]).includes(value);

/** How the registry treats a group of kinds. */
export type CedulaFamily =
  | "rural"
  | "industrial"
  | "cpr"
  | "cci"
  | "ccb"
  | "cir";

/** Where the cédula itself goes (its guarantees are planned apart). */
export type CedulaActWhere =
  | "livro-3"
  | "averbacao-matricula"
  | "entidade-registradora"
  | "nenhum";

export interface Deadline {
  days: number;
  business: boolean;
  basis: string;
}

export interface LawChange {
  /** What the old rule said, with its articles. */
  before: string;
  /** What changed it and what is in force now, with the articles. */
  now: string;
  /** How to do it today, step by step, with the articles. */
  how: string[];
}

export interface KindInfo {
  label: string;
  family: CedulaFamily;
  law: string;
  cedulaAct: { where: CedulaActWhere; text: string; basis: string };
  deadline: Deadline;
  /** Rules the registrar must keep in mind for this kind. */
  rules: string[];
  /**
   * What changed since the Caderno IRIB nº 9 (2016) (decision of
   * 21/11/2026: "quando citar que a lei mudou ou revogou, citar a correta
   * e como fazer"): what the study said, what is in force, how to do it.
   */
  divergence?: LawChange;
  /** A point not read in the official text: confirm before relying on it. */
  toConfirm?: string;
}

const LRP = "Lei nº 6.015/1973";
const DL167 = "Decreto-Lei nº 167/1967";
const DL413 = "Decreto-Lei nº 413/1969";

const RURAL_NO_INSCRIPTION = {
  where: "nenhum" as const,
  text: "A cédula rural não tem mais inscrição própria no Registro de Imóveis: registram-se as garantias reais que ela constitui.",
  basis: `${DL167}, arts. 30 a 40, e ${LRP}, art. 167, I, item 13, revogados pela Lei nº 13.986/2020 (art. 61, V e VI).`,
};

const RURAL_DEADLINE: Deadline = {
  days: 10,
  business: false,
  basis: `${LRP}, art. 188, caput; 5 dias para o cancelamento de garantias (art. 188, § 1º, I).`,
};

const RURAL_RULES = [
  `É vedado exigir documento complementar e negar o registro porque a garantia vale menos que o crédito; a certidão negativa de débitos é inexigível (${DL167}, art. 14, §§ 3º a 6º, incluídos pela Lei nº 13.986/2020).`,
  `Emolumentos da garantia destinada ao crédito rural com teto legal (Lei nº 10.169/2000, art. 2º, § 2º, na redação da Lei nº 13.986/2020).`,
  `Prorrogação: dispensados o aditivo e a assinatura do emitente, basta a anotação do credor no título (${DL167}, art. 62, na redação da Lei nº 14.421/2022).`,
  `A venda dos bens apenhados ou hipotecados depende de anuência prévia e escrita do credor (${DL167}, art. 59).`,
];

const RURAL_DIVERGENCE: LawChange = {
  before:
    "O Caderno IRIB nº 9 (2016) manda registrar a cédula rural no Livro nº 3, Registro Auxiliar (DL 167/1967, art. 30, e LRP, art. 167, I, item 13), em 3 dias úteis (DL 167/1967, art. 38), e exigir CCIR e ITR em alguns casos.",
  now: "A Lei nº 13.986/2020 (art. 61, V e VI) revogou os arts. 30 a 40 do DL 167/1967 e o item 13 do inciso I do art. 167 da Lei nº 6.015/1973. Hoje a cédula rural não tem inscrição própria: registram-se só as garantias reais que ela constitui, e é vedado exigir documento complementar ou negar o registro porque a garantia vale menos que o crédito (DL 167/1967, art. 14, §§ 3º a 6º, incluídos pela mesma lei).",
  how: [
    "Hipoteca cedular: registro na matrícula do imóvel hipotecado (LRP, art. 167, I, item 2).",
    "Penhor rural: registro no Livro nº 3 do Registro de Imóveis onde estão os bens apenhados (Código Civil, art. 1.438; LRP, arts. 167, I, item 15, e 178, VI).",
    "Alienação fiduciária de imóvel: registro na matrícula (LRP, art. 167, I, item 35).",
    "Prazo: 10 dias do protocolo; cancelamento de garantia, 5 dias (LRP, art. 188, caput e § 1º, I).",
    "Não exija CCIR, ITR, CND nem outro documento além do título (DL 167/1967, art. 14, §§ 3º e 4º).",
    "Emolumentos da garantia com o teto do crédito rural (Lei nº 10.169/2000, art. 2º, § 2º).",
  ],
};

const INDUSTRIAL_ACT = (law: string) => ({
  where: "livro-3" as const,
  text: "Registro da cédula no Livro nº 3, Registro Auxiliar, no Registro de Imóveis da situação dos bens dados em garantia, sem prejuízo do registro da hipoteca na matrícula.",
  basis: `${LRP}, arts. 167, I, item 14, e 178, II; ${DL413}, art. 30${law ? `; ${law}` : ""}.`,
});

const INDUSTRIAL_DEADLINE: Deadline = {
  days: 3,
  business: true,
  basis: `${DL413}, art. 38.`,
};

const INDUSTRIAL_RULES = [
  `Endossos, aditivos e atos que alterem a garantia são averbados à margem da inscrição (${DL413}, art. 36); o cancelamento se faz por averbação, à vista da quitação ou de ordem judicial (art. 39).`,
  `A regra de não exigir documento complementar nem negar o registro porque a garantia vale menos que o crédito também se aplica a esta cédula (${DL167}, art. 14, §§ 3º, 5º e 6º).`,
  "Alienação fiduciária de bem móvel: além do Livro nº 3, recomenda-se o registro no Títulos e Documentos do domicílio do devedor, pela divergência dos tribunais sobre a eficácia perante terceiros (LRP, art. 129, 5º; Caderno IRIB nº 9, item 7).",
];

export const KIND_INFO: Record<CedulaKind, KindInfo> = {
  "rural-pignoraticia": {
    label: "Cédula Rural Pignoratícia",
    family: "rural",
    law: DL167,
    cedulaAct: RURAL_NO_INSCRIPTION,
    deadline: RURAL_DEADLINE,
    rules: RURAL_RULES,
    divergence: RURAL_DIVERGENCE,
  },
  "rural-hipotecaria": {
    label: "Cédula Rural Hipotecária",
    family: "rural",
    law: DL167,
    cedulaAct: RURAL_NO_INSCRIPTION,
    deadline: RURAL_DEADLINE,
    rules: RURAL_RULES,
    divergence: RURAL_DIVERGENCE,
  },
  "rural-pignoraticia-hipotecaria": {
    label: "Cédula Rural Pignoratícia e Hipotecária",
    family: "rural",
    law: DL167,
    cedulaAct: RURAL_NO_INSCRIPTION,
    deadline: RURAL_DEADLINE,
    rules: RURAL_RULES,
    divergence: RURAL_DIVERGENCE,
  },
  "nota-credito-rural": {
    label: "Nota de Crédito Rural",
    family: "rural",
    law: DL167,
    cedulaAct: {
      where: "nenhum",
      text: "A nota de crédito rural não constitui garantia real e não tem mais inscrição no Registro de Imóveis: não há ato a praticar, salvo se vier acompanhada de garantia real em instrumento próprio.",
      basis: RURAL_NO_INSCRIPTION.basis,
    },
    deadline: RURAL_DEADLINE,
    rules: RURAL_RULES,
    divergence: {
      before:
        "O Caderno IRIB nº 9 (2016) manda inscrever a nota de crédito rural no Livro nº 3 do Registro de Imóveis (DL 167/1967, art. 30, d).",
      now: "Essa inscrição foi revogada pela Lei nº 13.986/2020 (art. 61, V, a, que revogou os arts. 30 a 40 do DL 167/1967). A nota de crédito rural não constitui garantia real: não há ato a praticar no Registro de Imóveis.",
      how: [
        "Apresentada sozinha para registro: informe ao apresentante, por nota, que desde a Lei nº 13.986/2020 a nota de crédito rural não tem ato no Registro de Imóveis.",
        "Veio com garantia real em instrumento próprio (hipoteca, penhor rural): registre a garantia, como nas demais cédulas rurais.",
      ],
    },
  },
  "credito-industrial": {
    label: "Cédula de Crédito Industrial",
    family: "industrial",
    law: DL413,
    cedulaAct: INDUSTRIAL_ACT(""),
    deadline: INDUSTRIAL_DEADLINE,
    rules: INDUSTRIAL_RULES,
  },
  "credito-exportacao": {
    label: "Cédula de Crédito à Exportação",
    family: "industrial",
    law: `Lei nº 6.313/1975 e ${DL413}`,
    cedulaAct: INDUSTRIAL_ACT("Lei nº 6.313/1975, art. 4º"),
    deadline: INDUSTRIAL_DEADLINE,
    rules: INDUSTRIAL_RULES,
  },
  "credito-comercial": {
    label: "Cédula de Crédito Comercial",
    family: "industrial",
    law: `Lei nº 6.840/1980 e ${DL413}`,
    cedulaAct: INDUSTRIAL_ACT("Lei nº 6.840/1980, art. 5º"),
    deadline: INDUSTRIAL_DEADLINE,
    rules: INDUSTRIAL_RULES,
    toConfirm:
      "O texto oficial da Lei nº 6.840/1980 não pôde ser lido em 21/11/2026: confirme o art. 5º, que manda aplicar a esta cédula as regras da industrial.",
  },
  "produto-rural": {
    label: "Cédula de Produto Rural (CPR)",
    family: "cpr",
    law: "Lei nº 8.929/1994",
    cedulaAct: {
      where: "entidade-registradora",
      text: "A CPR é registrada ou depositada em entidade autorizada pelo Banco Central, em até 30 dias úteis da emissão ou do aditamento (10 dias úteis se emitida até 10/8/2022). Sua validade não depende de registro em cartório; no Registro de Imóveis vão as garantias reais.",
      basis:
        "Lei nº 8.929/1994, art. 12, caput, I e II (redação da Lei nº 14.421/2022), e § 2º (redação da Lei nº 13.986/2020).",
    },
    deadline: {
      days: 3,
      business: true,
      basis:
        "Lei nº 8.929/1994, art. 12, § 2º: contados da apresentação do título ou da certidão de inteiro teor.",
    },
    rules: [
      "As garantias (hipoteca, penhor rural, alienação fiduciária de imóvel e de produtos agropecuários) são levadas ao Registro de Imóveis onde estiverem os bens (Lei nº 8.929/1994, art. 12, §§ 1º, 2º e 4º).",
      "Emolumentos das garantias: os mesmos da cédula de crédito rural (Lei nº 8.929/1994, art. 12, § 3º).",
    ],
    divergence: {
      before:
        "O Caderno IRIB nº 9 (2016) manda registrar a CPR no Livro nº 3 do Registro de Imóveis do domicílio do emitente (Lei nº 8.929/1994, art. 12, na redação original) e averbá-la na matrícula do imóvel hipotecado.",
      now: "As Leis nº 13.986/2020 e 14.421/2022 deram nova redação ao art. 12 da Lei nº 8.929/1994: a CPR e seus aditamentos são registrados ou depositados em entidade autorizada pelo Banco Central, em até 30 dias úteis da emissão ou do aditamento (10 dias úteis se emitida até 10/8/2022), e a validade da CPR não depende de registro em cartório (art. 12, caput e § 2º).",
      how: [
        "Não registre a CPR no Livro nº 3: o registro dela é na entidade autorizada pelo Banco Central.",
        "Registre as garantias no Registro de Imóveis onde estão os bens: hipoteca e alienação fiduciária de imóvel na matrícula; penhor rural e alienação fiduciária de produtos agropecuários no Livro nº 3 (Lei nº 8.929/1994, art. 12, §§ 1º e 4º).",
        "Prazo: 3 dias úteis da apresentação do título ou da certidão de inteiro teor (art. 12, § 2º).",
        "Emolumentos: os mesmos das garantias da cédula de crédito rural (art. 12, § 3º).",
      ],
    },
  },
  "credito-imobiliario": {
    label: "Cédula de Crédito Imobiliário (CCI)",
    family: "cci",
    law: "Lei nº 10.931/2004",
    cedulaAct: {
      where: "averbacao-matricula",
      text: "Averbação da emissão da CCI na matrícula do imóvel dado em garantia, constando exclusivamente o número, a série e a instituição custodiante. A garantia real precisa estar registrada.",
      basis: "Lei nº 10.931/2004, art. 18, § 5º.",
    },
    deadline: {
      days: 15,
      business: false,
      basis: "Lei nº 10.931/2004, art. 52.",
    },
    rules: [
      "Pedidas juntas, a averbação da emissão e o registro da garantia contam como ato único para emolumentos (Lei nº 10.931/2004, art. 18, § 6º).",
      "A averbação se faz em todas as matrículas dos imóveis dados em garantia.",
    ],
  },
  "credito-bancario": {
    label: "Cédula de Crédito Bancário (CCB)",
    family: "ccb",
    law: "Lei nº 10.931/2004",
    cedulaAct: {
      where: "nenhum",
      text: "A CCB não é registrada nem averbada: sua validade não depende de registro. Registram-se só as garantias reais, no Registro de Imóveis ou no Títulos e Documentos, conforme a garantia.",
      basis: "Lei nº 10.931/2004, art. 42.",
    },
    deadline: {
      days: 15,
      business: false,
      basis: "Lei nº 10.931/2004, art. 52.",
    },
    rules: [
      "CCB usada em operação de crédito rural: emolumentos da garantia iguais aos da cédula de crédito rural (Lei nº 10.931/2004, art. 42-B).",
      "Penhor comum e alienação fiduciária de bem móvel vão ao Títulos e Documentos; penhor rural, industrial e mercantil e garantia sobre imóvel vão ao Registro de Imóveis.",
    ],
  },
  "imobiliaria-rural": {
    label: "Cédula Imobiliária Rural (CIR)",
    family: "cir",
    law: "Lei nº 13.986/2020",
    cedulaAct: {
      where: "entidade-registradora",
      text: "A CIR é registrada ou depositada em entidade autorizada pelo Banco Central, em até 5 dias úteis da emissão. No Registro de Imóveis vai o patrimônio rural em afetação que a garante.",
      basis: "Lei nº 13.986/2020, art. 19.",
    },
    deadline: RURAL_DEADLINE,
    rules: [
      "O patrimônio rural em afetação é constituído por registro na matrícula, a requerimento do proprietário (Lei nº 13.986/2020, art. 9º; LRP, art. 167, I, item 47); seu cancelamento se faz por averbação (art. 15).",
      "A CIR identifica o patrimônio afetado pelos números de registro e de matrícula e pelas coordenadas georreferenciadas (Lei nº 13.986/2020, art. 22, § 1º).",
    ],
  },
};

/** The kinds in the order the form offers them. */
export const KIND_OPTIONS = CEDULA_KINDS.map((kind) => ({
  value: kind,
  label: KIND_INFO[kind].label,
}));

/** "10 dias" or "3 dias úteis". */
export function deadlineText(deadline: Deadline): string {
  return `${deadline.days} ${deadline.days === 1 ? "dia" : "dias"}${deadline.business ? " úteis" : ""}`;
}

// ------------------------------------------------------------ guarantees

export const GUARANTEE_KINDS = [
  "penhor",
  "hipoteca",
  "af-imovel",
  "af-movel",
  "af-produto",
  "afetacao",
  "pessoal",
] as const;
export type GuaranteeKind = (typeof GUARANTEE_KINDS)[number];
export const isGuaranteeKind = (value: string): value is GuaranteeKind =>
  (GUARANTEE_KINDS as readonly string[]).includes(value);

export const GUARANTEE_LABELS: Record<GuaranteeKind, string> = {
  penhor: "Penhor (rural, industrial ou mercantil)",
  hipoteca: "Hipoteca",
  "af-imovel": "Alienação fiduciária de imóvel",
  "af-movel": "Alienação fiduciária de bem móvel",
  "af-produto": "Alienação fiduciária de produto agropecuário",
  afetacao: "Patrimônio rural em afetação",
  pessoal: "Aval ou fiança (garantia pessoal)",
};

/** Whether a guarantee sits on an imóvel with a matrícula. */
export const ON_MATRICULA: ReadonlySet<GuaranteeKind> = new Set([
  "hipoteca",
  "af-imovel",
  "afetacao",
]);
