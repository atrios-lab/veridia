/**
 * Livro de Cadastro de Aquisição de Imóvel Rural por Estrangeiro (decision
 * of 27/11/2026). Pure rules: who is lançado, what each assento holds, the
 * columns of the book and the trimestral relação.
 *
 * Sources (texts read; the federal ones still to be checked word for word
 * at planalto.gov.br):
 * - Lei nº 5.709/1971, arts. 1º, 10 and 11; Decreto nº 74.965/1974, arts.
 *   15 and 16 (cadastro especial in livro auxiliar; páginas duplas in 5
 *   colunas: nº, Adquirente e Transmitente, Descrição do Imóvel, Certidões
 *   e Autorizações, Averbações).
 * - Provimento nº 156/2016 da CGJ/RN (Código de Normas), arts. 68, § 1º,
 *   274 (redação do Prov. nº 223/2020: aquisições E arrendamentos, also by
 *   the pessoa jurídica brasileira equiparada) and 275 (relação trimestral
 *   à CGJ e ao Ministério da Agricultura; § 1º also to the Conselho when in
 *   área indispensável à segurança nacional; § 2º no aquisição, no
 *   comunicação), 533, 538 to 541.
 */

export const FOREIGN_KINDS = {
  aquisicao: "Aquisição",
  arrendamento: "Arrendamento",
} as const;
export type ForeignKind = keyof typeof FOREIGN_KINDS;

/** Who acquires (Lei nº 5.709/1971, art. 1º; Prov. 156/RN, art. 274). */
export const ACQUIRER_KINDS = {
  "pf-estrangeira": "Pessoa física estrangeira residente no Brasil",
  "pj-estrangeira":
    "Pessoa jurídica estrangeira autorizada a funcionar no Brasil",
  "pj-equiparada":
    "Pessoa jurídica brasileira com maioria do capital de estrangeiros residentes ou sediados no exterior",
} as const;
export type AcquirerKind = keyof typeof ACQUIRER_KINDS;

export interface ForeignInput {
  kind: ForeignKind;
  /** The registro na matrícula the assento follows (data do registro). */
  registeredOn: string;
  matricula: number | null;
  actRef: string;
  acquirerKind: AcquirerKind;
  acquirerName: string;
  nationality: string;
  /** Passaporte, RNM/CRNM or the atos constitutivos of the company. */
  acquirerDocument: string;
  /** The Brazilian spouse or companion, when there is one. */
  spouseName: string;
  spouseCpf: string;
  transmitterName: string;
  transmitterDocument: string;
  /** Área in hectares, as written ("12,5000"). */
  area: string;
  municipality: string;
  description: string;
  ccir: string;
  /** Faixa de fronteira or área indispensável à segurança nacional. */
  securityArea: boolean;
  authorityBody: string;
  authorizationNumber: string;
  authorizationDate: string;
  notes: string;
}

export class ForeignError extends Error {}

const text = (raw: Record<string, unknown>, key: string, max = 2000) =>
  String(raw[key] ?? "")
    .trim()
    .slice(0, max);

function isoOf(value: string): string | null {
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  const iso = br ? `${br[3]}-${br[2]}-${br[1]}` : value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const at = new Date(Date.UTC(y, m - 1, d));
  return at.getUTCFullYear() === y &&
    at.getUTCMonth() === m - 1 &&
    at.getUTCDate() === d
    ? iso
    : null;
}

/**
 * The form, checked against what the law asks in each assento (Decreto nº
 * 74.965/1974, art. 15): identity of the parties or atos constitutivos, the
 * imóvel described, and the authorization when it is required.
 */
export function readForeignInput(
  raw: Record<string, unknown>,
  today: string,
): ForeignInput {
  const kind = (
    raw.kind === "arrendamento" ? "arrendamento" : "aquisicao"
  ) as ForeignKind;
  const acquirerKind = (
    Object.keys(ACQUIRER_KINDS).includes(String(raw.acquirerKind))
      ? raw.acquirerKind
      : "pf-estrangeira"
  ) as AcquirerKind;
  const registeredOn = isoOf(text(raw, "registeredOn", 20));
  if (!registeredOn) {
    throw new ForeignError("Informe a data do registro (dd/mm/aaaa).");
  }
  if (registeredOn > today) {
    throw new ForeignError("A data do registro não pode ser depois de hoje.");
  }
  const matriculaRaw = text(raw, "matricula", 12).replace(/\D/g, "");
  const input: ForeignInput = {
    kind,
    registeredOn,
    matricula: matriculaRaw ? Number(matriculaRaw) : null,
    actRef: text(raw, "actRef", 40),
    acquirerKind,
    acquirerName: text(raw, "acquirerName", 300),
    nationality: text(raw, "nationality", 100),
    acquirerDocument: text(raw, "acquirerDocument", 300),
    spouseName: text(raw, "spouseName", 300),
    spouseCpf: text(raw, "spouseCpf", 20).replace(/\D/g, ""),
    transmitterName: text(raw, "transmitterName", 300),
    transmitterDocument: text(raw, "transmitterDocument", 60),
    area: text(raw, "area", 30),
    municipality: text(raw, "municipality", 120),
    description: text(raw, "description", 5000),
    ccir: text(raw, "ccir", 40),
    securityArea: raw.securityArea === "on" || raw.securityArea === true,
    authorityBody: text(raw, "authorityBody", 200),
    authorizationNumber: text(raw, "authorizationNumber", 100),
    authorizationDate: "",
    notes: text(raw, "notes", 5000),
  };
  const authDate = text(raw, "authorizationDate", 20);
  if (authDate) {
    const iso = isoOf(authDate);
    if (!iso) throw new ForeignError("A data da autorização não é válida.");
    input.authorizationDate = iso;
  }
  const missing: string[] = [];
  if (!input.acquirerName) missing.push("nome do adquirente ou arrendatário");
  if (!input.acquirerDocument) {
    missing.push(
      acquirerKind === "pf-estrangeira"
        ? "documento de identidade (passaporte ou RNM)"
        : "atos constitutivos da pessoa jurídica",
    );
  }
  if (acquirerKind === "pf-estrangeira" && !input.nationality) {
    missing.push("nacionalidade");
  }
  if (!input.municipality) missing.push("município do imóvel");
  if (!input.area) missing.push("área do imóvel");
  if (!input.description) missing.push("descrição do imóvel");
  if (missing.length) {
    throw new ForeignError(
      `Falta: ${missing.join(", ")} (Decreto nº 74.965/1974, art. 15).`,
    );
  }
  if (input.spouseCpf && input.spouseCpf.length !== 11) {
    throw new ForeignError("O CPF do cônjuge deve ter 11 números.");
  }
  return input;
}

/**
 * What the oficial must still check before lançar (warnings, not blocks):
 * the authorization the law asks, and the área indispensável à segurança.
 */
export function foreignWarnings(input: ForeignInput): string[] {
  const out: string[] = [];
  const needsAuthorization =
    input.acquirerKind !== "pf-estrangeira" || input.securityArea;
  if (needsAuthorization && !input.authorizationNumber) {
    out.push(
      input.securityArea
        ? "Área indispensável à segurança nacional: falta o assentimento prévio do órgão competente (Prov. 156/RN, art. 275, § 1º)."
        : "Pessoa jurídica estrangeira ou equiparada: falta a aprovação do INCRA, qualquer que seja a área (Prov. 156/RN, art. 539).",
    );
  }
  if (!input.ccir) {
    out.push("Sem o número do CCIR do imóvel.");
  }
  return out;
}

const br = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};

export interface ForeignEntry extends ForeignInput {
  number: number;
  /** Averbações on the assento, in order. */
  averbacoes: string[];
}

/** The 5 columns of the model (Decreto nº 74.965/1974, art. 15, p. único). */
export const FOREIGN_COLUMNS = [
  "Nº",
  "Adquirente e Transmitente",
  "Descrição do Imóvel",
  "Certidões e Autorizações",
  "Averbações",
] as const;

export function foreignRow(e: ForeignEntry): string[] {
  const acquirer = [
    `${FOREIGN_KINDS[e.kind]}: ${e.acquirerName}`,
    ACQUIRER_KINDS[e.acquirerKind],
    e.nationality && `Nacionalidade: ${e.nationality}`,
    e.acquirerDocument && `Documento: ${e.acquirerDocument}`,
    e.spouseName &&
      `Cônjuge ou companheiro(a): ${e.spouseName}${e.spouseCpf ? `, CPF ${e.spouseCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}` : ""}`,
    e.transmitterName &&
      `Transmitente: ${e.transmitterName}${e.transmitterDocument ? `, ${e.transmitterDocument}` : ""}`,
  ]
    .filter(Boolean)
    .join("\n");
  const property = [
    e.description,
    `Área: ${e.area} ha · Município: ${e.municipality}`,
    e.ccir && `CCIR ${e.ccir}`,
    e.matricula !== null &&
      `Matrícula nº ${e.matricula.toLocaleString("pt-BR")}${e.actRef ? `, ${e.actRef}` : ""}, registrada em ${br(e.registeredOn)}`,
    e.securityArea && "Área indispensável à segurança nacional",
  ]
    .filter(Boolean)
    .join("\n");
  const authorization = e.authorizationNumber
    ? `${e.authorityBody || "Órgão competente"} nº ${e.authorizationNumber}${e.authorizationDate ? `, de ${br(e.authorizationDate)}` : ""}`
    : "Sem autorização lançada";
  return [
    e.number.toLocaleString("pt-BR"),
    acquirer,
    property,
    [authorization, e.notes].filter(Boolean).join("\n"),
    e.averbacoes.join("\n"),
  ];
}

/** 1 to 4: the trimestre of a date (jan-mar, abr-jun, jul-set, out-dez). */
export function quarterOf(iso: string): { year: number; quarter: number } {
  return {
    year: Number(iso.slice(0, 4)),
    quarter: Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1,
  };
}

export function quarterSpan(
  year: number,
  quarter: number,
): { from: string; to: string; label: string } {
  const first = (quarter - 1) * 3 + 1;
  const last = first + 2;
  const end = new Date(Date.UTC(year, last, 0)).getUTCDate();
  const pad = (v: number) => String(v).padStart(2, "0");
  return {
    from: `${year}-${pad(first)}-01`,
    to: `${year}-${pad(last)}-${pad(end)}`,
    label: `${quarter}º trimestre de ${year}`,
  };
}

/** The trimestre just ended, the one the relação is due for. */
export function lastClosedQuarter(today: string): {
  year: number;
  quarter: number;
} {
  const { year, quarter } = quarterOf(today);
  return quarter === 1
    ? { year: year - 1, quarter: 4 }
    : { year, quarter: quarter - 1 };
}

/**
 * Who receives the relação (Prov. 156/RN, art. 275; Lei nº 5.709/1971, art.
 * 11): the CGJ and the INCRA (Ministério da Agricultura); the Conselho when
 * any imóvel of the trimestre is in área indispensável à segurança nacional.
 */
export function recipientsFor(entries: Pick<ForeignEntry, "securityArea">[]) {
  const list = [
    "Corregedoria Geral da Justiça",
    "Superintendência Regional do INCRA (Ministério da Agricultura)",
  ];
  if (entries.some((e) => e.securityArea)) {
    list.push(
      "Secretaria Geral do Conselho de Defesa Nacional (área indispensável à segurança nacional)",
    );
  }
  return list;
}

/** What the screen says about the trimestre, in plain words. */
export function quarterRule(count: number, state: string): string {
  if (count > 0) {
    return "Envie a relação deste trimestre à Corregedoria e ao INCRA (Prov. 156/RN, art. 275; Lei nº 5.709/1971, art. 11). A lei prevê perda do cargo para quem não envia (Lei nº 5.709/1971, art. 11).";
  }
  return state === "RN"
    ? "Nenhuma aquisição neste trimestre: no RN a comunicação fica dispensada (Prov. 156/RN, art. 275, § 2º). Se quiser deixar registrado, gere a certidão negativa."
    : "Nenhuma aquisição neste trimestre. Confira no Código de Normas do seu estado se a comunicação negativa é exigida; se for, gere a certidão negativa.";
}
