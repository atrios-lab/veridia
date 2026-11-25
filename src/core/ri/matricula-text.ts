import {
  ACT_NATURES,
  type ActEffect,
  type PartyRole,
  ROLES_BY_EFFECT,
} from "./acts.ts";
import { isoDate, matriculaNumber } from "./property.ts";

/**
 * What a matrícula says, read from its text (a Word file, a PDF with text,
 * or what the assistente virtual transcribed): the opening and each
 * lançamento. Nothing here is saved: the screen shows it for conferência,
 * and only what the clerk confirms becomes data.
 */

export interface ReadParty {
  name: string;
  document: string;
  role: PartyRole;
  share: string;
}

export interface ReadAct {
  kind: "R" | "AV";
  seq: number;
  nature: string;
  effect: ActEffect;
  registeredOn: string | null;
  summary: string;
  parties: ReadParty[];
  /** The order number of the ato a cancelamento cancels, when it says. */
  cancelsSeq: number | null;
}

export interface MatriculaReading {
  book: 2 | 3;
  number: number | null;
  cnm: string;
  openedOn: string | null;
  location: 0 | 1 | null;
  denomination: string;
  street: string;
  district: string;
  area: string;
  ccir: string;
  nirf: string;
  car: string;
  incra: string;
  sigef: string;
  origin: string;
  description: string;
  owners: ReadParty[];
  acts: ReadAct[];
  notes: string[];
}

const MONTHS = [
  "janeiro",
  "fevereiro",
  "marco",
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

const fold = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** The first date of the text: 05/03/1988 or "5 de março de 1988". */
export function firstDate(text: string): string | null {
  const numeric = /\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/.exec(text);
  const written = /\b(\d{1,2})[ºo°]?\s+de\s+([a-zçã]+)\s+de\s+(\d{4})\b/.exec(
    fold(text),
  );
  const at = (m: RegExpExecArray | null) => (m ? m.index : Infinity);
  if (numeric && at(numeric) <= at(written)) {
    return isoDate(`${numeric[1]}/${numeric[2]}/${numeric[3]}`);
  }
  if (written) {
    const month = MONTHS.indexOf(written[2] ?? "");
    if (month >= 0) return isoDate(`${written[1]}/${month + 1}/${written[3]}`);
  }
  return null;
}

/** The nature of a lançamento, from its words; "" when none matches. */
export function natureOf(text: string): {
  name: string;
  kind: "R" | "AV";
  effect: ActEffect;
} | null {
  const t = fold(text.slice(0, 600));
  const rules: [RegExp, string][] = [
    [/cancelamento|cancela(-se|do)|baixa d[ae]/, "Cancelamento"],
    [
      /consolida[cç][aã]o da propriedade/,
      "Consolidação da propriedade fiduciária",
    ],
    [/aliena[cç][aã]o fiduci[aá]ria/, "Alienação fiduciária"],
    [/hipoteca/, "Hipoteca"],
    [/c[eé]dula/, "Cédula de crédito"],
    [/penhora/, "Penhora"],
    [/indisponibilidade/, "Indisponibilidade"],
    [/usufruto/, "Usufruto"],
    [/servid[aã]o/, "Servidão"],
    [/compra e venda|compra-e-venda|vend(eu|ido)/, "Compra e venda"],
    [/doa[cç][aã]o|doad/, "Doação"],
    [/permuta/, "Permuta"],
    [/partilha|invent[aá]rio|formal de/, "Partilha (inventário ou divórcio)"],
    [/adjudica/, "Adjudicação"],
    [/arremata/, "Arrematação"],
    [/usucapi/, "Usucapião"],
    [/da[cç][aã]o em pagamento/, "Dação em pagamento"],
    [/integraliza/, "Integralização de capital"],
    [/georreferenc/, "Georreferenciamento"],
    [/retifica/, "Retificação de área"],
    [/desmembra/, "Desmembramento"],
    [/constru[cç][aã]o|edifica/, "Construção"],
    [
      /casamento|altera[cç][aã]o de nome|div[oó]rcio/,
      "Casamento ou alteração de nome",
    ],
    [/ccir|\bcar\b|\bitr\b|nirf/, "CCIR, CAR ou ITR"],
    [/encerra/, "Encerramento da matrícula"],
  ];
  for (const [rule, name] of rules) {
    if (rule.test(t)) {
      const known = ACT_NATURES.find((n) => n.name === name);
      if (known && known.kind !== "M") {
        return { name, kind: known.kind, effect: known.effect };
      }
    }
  }
  return null;
}

/** Every CPF (11) or CNPJ (14) in a piece of text, as digits. */
function documentsIn(text: string): string[] {
  return [
    ...text.matchAll(
      /\d{2,3}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2}/g,
    ),
  ]
    .map((m) => m[0].replace(/\D/g, ""))
    .filter((d) => d.length === 11 || d.length === 14);
}

const ROLE_WORDS: [RegExp, PartyRole][] = [
  [
    /(?:adquirente|comprador|outorgad[oa] comprador|donat[aá]ri)[a-z()]*\s*:?\s*/i,
    "adquirente",
  ],
  [
    /(?:transmitente|vendedor|outorgante vendedor|doador)[a-z()]*\s*:?\s*/i,
    "transmitente",
  ],
  [/(?:credor)[a-z()]*\s*:?\s*/i, "credor"],
  [/(?:devedor|emitente)[a-z()]*\s*:?\s*/i, "devedor"],
  [/(?:propriet[aá]ri)[a-z()]*\s*:?\s*/i, "titular"],
];

/**
 * "ADQUIRENTE: FULANO DE TAL, brasileiro, CPF 000..." → the party, when
 * the text names its role that way. Only what is written; the rest is for
 * the clerk or the assistente virtual.
 */
export function partiesIn(text: string, effect: ActEffect): ReadParty[] {
  const allowed = new Set(ROLES_BY_EFFECT[effect]);
  const out: ReadParty[] = [];
  for (const [label, role] of ROLE_WORDS) {
    if (!allowed.has(role)) continue;
    const re = new RegExp(`${label.source}([^\\n;]{3,200})`, "gi");
    for (const m of text.matchAll(re)) {
      const tail = m[1] ?? "";
      const name = (tail.split(/,|\(|\s-\s/)[0] ?? "")
        .replace(/\s+/g, " ")
        .replace(/[.;:]+$/, "")
        .trim();
      if (name.length < 4 || /^(o|a|os|as|do|da)\b/i.test(name)) continue;
      const [document = ""] = documentsIn(tail);
      if (!out.some((p) => p.name === name && p.role === role)) {
        out.push({ name, document, role, share: "" });
      }
    }
  }
  return out;
}

/** "R-3-1.234", "R.3/1234", "AV-02", "Av.5" at the start of a line. */
const MARK =
  /(^|\n)\s*(R|AV|Av)\s*[-.]?\s*0*(\d{1,4})\b(?:\s*[-/.]\s*[\d.]+)?\s*[-–:.]?\s*/g;

/** Reads the text of a whole matrícula: the opening and the lançamentos. */
export function readMatriculaText(text: string): MatriculaReading {
  const clean = text.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ");
  const marks = [...clean.matchAll(MARK)];
  const opening = (marks[0] ? clean.slice(0, marks[0].index) : clean).trim();
  const f = fold(opening);
  const notes: string[] = [];
  const numberMatch =
    /matr[ií]cula\s*(?:n[º°o.]*|numero)?\s*:?\s*([\d.]{1,9})/i.exec(opening);
  const number = matriculaNumber(numberMatch?.[1]);
  if (!number) notes.push("Não achei o número da matrícula no texto.");
  const cnm =
    /\b\d{6}\.?\d\.?\d{7}-?\d{2}\b/.exec(clean)?.[0]?.replace(/\D/g, "") ?? "";
  const area =
    /[áa]rea[^\d\n]{0,40}([\d.,]+\s*(?:ha\b|hectares?|m²|m2|metros quadrados|ares))/i.exec(
      opening,
    )?.[1] ?? "";
  const rural = /rural|fazenda|s[ií]tio|gleba|ccir|incra|hectare/.test(f);
  const urban = /\burbano\b|\blote\b|quadra|rua\b|avenida/.test(f);
  const denomination =
    /(?:denominad[oa]|conhecid[oa] como|im[óo]vel rural)\s+"?([A-ZÀ-Úa-zà-ú][^",;\n]{2,60})/i
      .exec(opening)?.[1]
      ?.trim() ?? "";
  const pick = (re: RegExp) =>
    (re.exec(opening)?.[1]?.trim() ?? "").replace(/[.,;:]+$/, "");
  const acts: ReadAct[] = marks.map((m, i) => {
    const start = (m.index ?? 0) + m[0].length;
    const end = marks[i + 1]?.index ?? clean.length;
    const body = clean.slice(start, end).trim();
    const kind = (m[2] ?? "R").toUpperCase() === "R" ? "R" : "AV";
    const nature = natureOf(body);
    const effect: ActEffect =
      nature?.effect ?? (kind === "R" ? "outro" : "outro");
    const cancels =
      effect === "cancelamento"
        ? Number(/\b(?:R|AV)\s*[-.]?\s*0*(\d{1,4})\b/i.exec(body)?.[1] ?? "") ||
          null
        : null;
    return {
      kind,
      seq: Number(m[3]),
      nature: nature?.name ?? "",
      effect,
      registeredOn: firstDate(body),
      summary: body.slice(0, 5000),
      parties: partiesIn(body, effect),
      cancelsSeq: cancels,
    };
  });
  if (marks.length === 0) {
    notes.push("Não achei lançamentos marcados com R- ou AV- no texto.");
  }
  return {
    // Only the words: "Livro 3-A" in the registro anterior is a
    // transcrição's book, not this one.
    book: /registro auxiliar/i.test(opening.slice(0, 400)) ? 3 : 2,
    number,
    cnm,
    openedOn: firstDate(opening),
    location: rural ? 1 : urban ? 0 : null,
    denomination,
    street: "",
    district: "",
    area,
    ccir: pick(/ccir[^\d\n]{0,20}([\d.\-/]{8,})/i),
    nirf: pick(/(?:nirf|itr)[^\d\n]{0,20}([\d.\-/]{6,})/i),
    car: pick(/\bcar\b[^\w\n]{0,20}([A-Z]{2}-\d{7}-[0-9A-F.]{8,})/i),
    incra: pick(
      /(?:c[óo]digo do im[óo]vel|incra|sncr)[^\d\n]{0,30}([\d.\-/]{8,})/i,
    ),
    sigef: pick(/sigef[^\w\n]{0,30}([0-9a-f-]{20,})/i),
    origin: pick(
      /(?:registro anterior|origem|transcri[çc][ãa]o)\s*:?\s*([^\n]{3,200})/i,
    ),
    // From the imóvel on: the office's header and the title line are not
    // the description.
    description: opening
      .slice(Math.max(0, opening.search(/im[óo]vel\s*:/i)))
      .slice(0, 5000)
      .trim(),
    owners: partiesIn(opening, "titularidade"),
    acts,
    notes,
  };
}

const str = (v: unknown, max = 5000) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const EFFECTS = Object.keys(ROLES_BY_EFFECT) as ActEffect[];
const ROLES = [
  "titular",
  "adquirente",
  "transmitente",
  "credor",
  "devedor",
  "outro",
] as const;

function coerceParty(raw: unknown, effect: ActEffect): ReadParty | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = str(r.name, 300);
  if (name.length < 2) return null;
  const allowed = ROLES_BY_EFFECT[effect];
  const role = (ROLES as readonly string[]).includes(str(r.role))
    ? (str(r.role) as PartyRole)
    : (allowed[0] ?? "outro");
  return {
    name,
    document: str(r.document, 20).replace(/\D/g, "").slice(0, 14),
    role: allowed.includes(role) ? role : (allowed[0] ?? "outro"),
    share: str(r.share, 40),
  };
}

/**
 * The assistente virtual's answer, checked field by field into the same
 * shape the text reading gives: anything malformed is dropped, never
 * guessed.
 */
export function coerceReading(raw: unknown): MatriculaReading {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const acts = (Array.isArray(r.acts) ? r.acts : [])
    .slice(0, 300)
    .flatMap((a): ReadAct[] => {
      if (!a || typeof a !== "object") return [];
      const x = a as Record<string, unknown>;
      const seq = Math.trunc(Number(x.seq));
      if (!Number.isFinite(seq) || seq < 1 || seq > 9999) return [];
      const effect = EFFECTS.includes(str(x.effect) as ActEffect)
        ? (str(x.effect) as ActEffect)
        : "outro";
      const cancels = Math.trunc(Number(x.cancelsSeq));
      return [
        {
          kind: str(x.kind).toUpperCase() === "AV" ? "AV" : "R",
          seq,
          nature: str(x.nature, 200),
          effect: effect === "titularidade" ? "transmissao" : effect,
          registeredOn: isoDate(str(x.registeredOn, 20)),
          summary: str(x.summary),
          parties: (Array.isArray(x.parties) ? x.parties : [])
            .slice(0, 40)
            .map((p) => coerceParty(p, effect))
            .filter((p): p is ReadParty => Boolean(p)),
          cancelsSeq: cancels > 0 ? cancels : null,
        },
      ];
    });
  const location = Number(r.location);
  return {
    book: Number(r.book) === 3 ? 3 : 2,
    number: matriculaNumber(r.number),
    cnm: str(r.cnm, 30).replace(/\D/g, "").slice(0, 16),
    openedOn: isoDate(str(r.openedOn, 20)),
    location: location === 0 || location === 1 ? location : null,
    denomination: str(r.denomination, 200),
    street: str(r.street, 300),
    district: str(r.district, 120),
    area: str(r.area, 120),
    ccir: str(r.ccir, 40),
    nirf: str(r.nirf, 40),
    car: str(r.car, 80),
    incra: str(r.incra, 40),
    sigef: str(r.sigef, 80),
    origin: str(r.origin, 500),
    description: str(r.description),
    owners: (Array.isArray(r.owners) ? r.owners : [])
      .slice(0, 40)
      .map((p) =>
        coerceParty({ ...(p as object), role: "titular" }, "titularidade"),
      )
      .filter((p): p is ReadParty => Boolean(p)),
    acts,
    notes: (Array.isArray(r.notes) ? r.notes : [str(r.notes)])
      .map((n) => str(n, 500))
      .filter(Boolean)
      .slice(0, 10),
  };
}
