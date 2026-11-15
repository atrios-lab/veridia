/**
 * The qualificação of a título (change qualificacao-de-titulos, decision of
 * 15/11/2026): every título presented for registro, averbação, retificação
 * or cancelamento is examined, and the office answers with a nota
 * devolutiva (the exigências, written all at once, articulated, with their
 * fundamento: Lei nº 6.015/1973, art. 198) or with the qualificação
 * positiva. For all the attributions of an office of cumulated
 * attributions, starting with the Registro Civil.
 *
 * Each exigência is an item (not loose text), so the reexame after the
 * título comes back, the list of providências and the note all come from
 * the same data. Pure: no database, no AI.
 */

export const ATTRIBUTIONS = {
  rcpn: "Registro Civil das Pessoas Naturais",
  ri: "Registro de Imóveis",
  notas: "Tabelionato de Notas",
  rtd: "Registro de Títulos e Documentos",
  rcpj: "Registro Civil das Pessoas Jurídicas",
  protesto: "Tabelionato de Protesto de Títulos",
} as const;
export type Attribution = keyof typeof ATTRIBUTIONS;
export const isAttribution = (value: string): value is Attribution =>
  Object.hasOwn(ATTRIBUTIONS, value);

/** The acts asked, by attribution; "outro" names a different one. */
export const ACTS: Record<Attribution, Record<string, string>> = {
  rcpn: {
    retificacao: "Retificação administrativa de registro",
    prenome: "Alteração de prenome",
    sobrenome: "Alteração de sobrenome",
    filiacao: "Reconhecimento de filiação",
    socioafetiva: "Reconhecimento de filiação socioafetiva",
    divorcio: "Averbação de divórcio ou separação",
    "registro-tardio": "Registro tardio de nascimento",
    traslado: "Traslado de assento lavrado no exterior",
    "uniao-estavel": "Registro de união estável (Livro E)",
    conversao: "Conversão de união estável em casamento",
    "casamento-religioso": "Registro de casamento religioso com efeitos civis",
    sentenca: "Averbação de sentença ou mandado judicial",
    obito: "Registro de óbito",
    outro: "Outro ato",
  },
  ri: {
    registro: "Registro",
    averbacao: "Averbação",
    "abertura-matricula": "Abertura de matrícula",
    retificacao: "Retificação",
    cancelamento: "Cancelamento",
    outro: "Outro ato",
  },
  notas: {
    escritura: "Lavratura de escritura",
    procuracao: "Procuração",
    ata: "Ata notarial",
    outro: "Outro ato",
  },
  rtd: {
    registro: "Registro",
    averbacao: "Averbação",
    notificacao: "Notificação extrajudicial",
    outro: "Outro ato",
  },
  rcpj: {
    registro: "Registro de pessoa jurídica",
    averbacao: "Averbação (ata, estatuto, alteração)",
    outro: "Outro ato",
  },
  protesto: {
    protesto: "Protesto de título ou documento de dívida",
    cancelamento: "Cancelamento de protesto",
    outro: "Outro ato",
  },
};

export type RequirementStatus = "pendente" | "parcial" | "cumprida";
export const REQUIREMENT_STATUS: Record<RequirementStatus, string> = {
  pendente: "Pendente",
  parcial: "Cumprida em parte",
  cumprida: "Cumprida",
};

export interface Requirement {
  id: string;
  /** The library item it came from, when it did. */
  libraryId?: string;
  title: string;
  /** What is wrong or missing in the título. */
  description: string;
  /** What to present, or do, to meet it. */
  howToComply: string;
  /** The law, norm or decision it rests on. */
  basis: string;
  /** What it refers to: a document, a person, an imóvel. Groups the note. */
  reference: string;
  status: RequirementStatus;
  /** What was seen in the reexame. */
  note: string;
  /** The round it was first written in (1 is the first qualificação). */
  round: number;
  /**
   * A new exigência in a reexame that comes from a document presented
   * only now. Without it, the note warns: the exigências are written all
   * at once (Lei nº 6.015/1973, art. 198).
   */
  fromNewDocument: boolean;
  /** Proposed by the AI (phase 2): a draft until a person checks it. */
  fromAi: boolean;
  /** A person checked the AI's proposal; only then the note goes out. */
  reviewed: boolean;
  /** The passage of the título that led to it, as the AI read it. */
  excerpt: string;
}

export type RoundResult = "aberta" | "exigencia" | "positiva";

export interface Round {
  n: number;
  /** ISO day of the examination. */
  date: string;
  result: RoundResult;
  requirements: Requirement[];
  /** In a reexame: what came back with the título. */
  newDocuments: string;
  /** The AI's summary of its proposal, when one was asked. */
  aiNote: string;
}

export interface Presenter {
  name: string;
  document: string;
  contact: string;
}

export interface QualificationData {
  attribution: Attribution;
  act: string;
  /** The act's name when it is "outro". */
  actOther: string;
  presenter: Presenter;
  /** The título presented: kind, date, office, parties in short. */
  document: string;
  /** What is asked: "averbação do divórcio no assento de casamento...". */
  object: string;
  /** The REQ of the online counter, or the counter's own number. */
  protocol: string;
  /** ISO day it was presented. */
  receivedOn: string;
  /** The general fundamentos of the note, one paragraph each. */
  fundamentals: string[];
  observations: string;
  rounds: Round[];
}

export const emptyRequirement = (id: string, round = 1): Requirement => ({
  id,
  title: "",
  description: "",
  howToComply: "",
  basis: "",
  reference: "",
  status: "pendente",
  note: "",
  round,
  fromNewDocument: false,
  fromAi: false,
  reviewed: false,
  excerpt: "",
});

export function emptyQualification(
  attribution: Attribution,
  today: string,
): QualificationData {
  return {
    attribution,
    act: "",
    actOther: "",
    presenter: { name: "", document: "", contact: "" },
    document: "",
    object: "",
    protocol: "",
    receivedOn: today,
    fundamentals: [...GENERAL_FUNDAMENTALS],
    observations: "",
    rounds: [
      {
        n: 1,
        date: today,
        result: "aberta",
        requirements: [],
        newDocuments: "",
        aiNote: "",
      },
    ],
  };
}

/**
 * The general fundamentos every note starts with, editable in each one:
 * the oficial's independence in the qualificação and the exigências
 * written all at once, with the right to the dúvida.
 */
export const GENERAL_FUNDAMENTALS = [
  "Compete ao oficial, com independência no exercício de suas atribuições, examinar a legalidade e a regularidade formal do título apresentado antes de praticar o ato pedido (Lei nº 8.935/1994, art. 28).",
  "Havendo exigência a satisfazer, ela é indicada por escrito, de uma só vez, articuladamente, de forma clara e objetiva, para que o interessado possa satisfazê-la (Lei nº 6.015/1973, art. 198).",
] as const;

export const actName = (
  data: Pick<QualificationData, "attribution" | "act" | "actOther">,
) =>
  data.act === "outro"
    ? data.actOther.trim() || "Outro ato"
    : (ACTS[data.attribution][data.act] ?? data.act);

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function requirementProblems(r: Requirement): string[] {
  const problems: string[] = [];
  if (!r.title.trim()) problems.push("Dê um título à exigência.");
  if (!r.description.trim())
    problems.push(
      `"${r.title || "Exigência"}": diga o que falta ou está errado.`,
    );
  if (!r.howToComply.trim())
    problems.push(`"${r.title || "Exigência"}": diga como cumprir.`);
  if (!r.basis.trim())
    problems.push(`"${r.title || "Exigência"}": informe o fundamento.`);
  return problems;
}

/** What must be filled before the qualificação can be saved. */
export function qualificationProblems(data: QualificationData): string[] {
  const problems: string[] = [];
  if (!isAttribution(data.attribution)) problems.push("Escolha a atribuição.");
  else if (!Object.hasOwn(ACTS[data.attribution], data.act)) {
    problems.push("Escolha o ato pedido.");
  }
  if (data.act === "outro" && !data.actOther.trim()) {
    problems.push("Diga qual é o ato pedido.");
  }
  if (!data.presenter.name.trim()) problems.push("Informe o apresentante.");
  if (!data.document.trim()) problems.push("Descreva o título apresentado.");
  if (!ISO_DAY.test(data.receivedOn))
    problems.push("Informe a data da apresentação.");
  return problems;
}

export const currentRound = (data: QualificationData): Round =>
  data.rounds[data.rounds.length - 1] ?? {
    n: 1,
    date: data.receivedOn,
    result: "aberta",
    requirements: [],
    newDocuments: "",
    aiNote: "",
  };

/** What the exigências of a round ask that is still not met. */
export const pendingOf = (round: Round) =>
  round.requirements.filter((r) => r.status !== "cumprida");

/** A note can go out: the round has exigências, each one complete. */
export function noteProblems(round: Round): string[] {
  const pending = pendingOf(round);
  if (pending.length === 0) {
    return ["Não há exigência pendente: emita a qualificação positiva."];
  }
  return [...pending.flatMap(requirementProblems), ...unreviewed(round)];
}

/** The AI's proposals nobody checked yet: nothing goes out with them. */
export function unreviewed(round: Round): string[] {
  const left = round.requirements.filter((r) => r.fromAi && !r.reviewed);
  return left.length
    ? [
        `${left.length === 1 ? "1 exigência proposta pelo Assistente Virtual ainda não foi conferida" : `${left.length} exigências propostas pelo Assistente Virtual ainda não foram conferidas`}: confira cada uma, ou tire-a.`,
      ]
    : [];
}

/** The positiva can go out: nothing pending in the round. */
export function positiveProblems(round: Round): string[] {
  const pending = pendingOf(round);
  if (!pending.length && unreviewed(round).length) return unreviewed(round);
  return pending.length
    ? [
        `Ainda há ${pending.length} ${pending.length === 1 ? "exigência pendente" : "exigências pendentes"}: marque como cumprida ou emita a nota devolutiva.`,
      ]
    : [];
}

/**
 * The título came back: a new round with the exigências not yet met,
 * kept with their ids so the reexame says what was done.
 */
export function openReexam(
  data: QualificationData,
  today: string,
  newDocuments: string,
): QualificationData {
  const last = currentRound(data);
  if (last.result === "aberta") return data;
  return {
    ...data,
    rounds: [
      ...data.rounds,
      {
        n: last.n + 1,
        date: today,
        result: "aberta",
        newDocuments: newDocuments.trim(),
        aiNote: "",
        requirements: pendingOf(last).map((r) => ({
          ...r,
          status: "pendente" as const,
          note: "",
        })),
      },
    ],
  };
}

export interface ReexamView {
  /** Of the previous note: met before this round or in it. */
  met: Requirement[];
  /** Written before and still not met (pending or partly met). */
  remaining: Requirement[];
  /** Written for the first time in this round. */
  added: Requirement[];
  /** Alerts the office must see before issuing. */
  warnings: string[];
}

/** What changed since the previous note, for the reexame's note. */
export function reexamView(
  data: QualificationData,
  roundIndex?: number,
): ReexamView {
  const index = roundIndex ?? data.rounds.length - 1;
  const round = data.rounds[index];
  const previous = data.rounds[index - 1];
  if (!round || !previous) {
    return { met: [], remaining: [], added: [], warnings: [] };
  }
  const now = new Map(round.requirements.map((r) => [r.id, r]));
  const met = [
    ...previous.requirements.filter(
      (r) => r.status !== "cumprida" && !now.has(r.id),
    ),
    ...round.requirements.filter(
      (r) => r.round < round.n && r.status === "cumprida",
    ),
  ];
  const remaining = round.requirements.filter(
    (r) => r.round < round.n && r.status !== "cumprida",
  );
  const added = round.requirements.filter((r) => r.round === round.n);
  const warnings = added
    .filter((r) => !r.fromNewDocument)
    .map(
      (r) =>
        `"${r.title || "Exigência nova"}" é nova e não decorre de documento apresentado agora. As exigências devem ser formuladas de uma só vez (Lei nº 6.015/1973, art. 198): confira se ela poderia ter sido feita na primeira nota.`,
    );
  return { met, remaining, added, warnings };
}

/** The list of providências: what the presenter has to bring or do. */
export function providencias(round: Round): string[] {
  return pendingOf(round).map(
    (r, i) =>
      `${i + 1}. ${r.howToComply.trim()}${r.status === "parcial" ? " (cumprida em parte)" : ""}`,
  );
}

/** Groups the exigências by what they refer to, in the order written. */
export function byReference(
  requirements: Requirement[],
): [string, Requirement[]][] {
  const groups = new Map<string, Requirement[]>();
  for (const r of requirements) {
    const key = r.reference.trim();
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.entries()];
}

/** The days since the título came in, by the calendar. */
export function daysSince(receivedOn: string, today: string): number {
  if (!ISO_DAY.test(receivedOn) || !ISO_DAY.test(today)) return 0;
  const ms =
    Date.parse(`${today}T12:00:00Z`) - Date.parse(`${receivedOn}T12:00:00Z`);
  return Math.max(0, Math.round(ms / 86_400_000));
}

export type QualificationStatus =
  | "em-analise"
  | "exigencia"
  | "reapresentado"
  | "positiva";

export const STATUS_LABELS: Record<QualificationStatus, string> = {
  "em-analise": "Em análise",
  exigencia: "Nota devolutiva emitida",
  reapresentado: "Reapresentado: em reexame",
  positiva: "Qualificação positiva",
};

export function statusOf(data: QualificationData): QualificationStatus {
  const round = currentRound(data);
  if (round.result === "positiva") return "positiva";
  if (round.result === "exigencia") return "exigencia";
  return round.n > 1 ? "reapresentado" : "em-analise";
}

// ---------------------------------------------------------------- stored

const text = (v: unknown, max = 5000) =>
  typeof v === "string" ? v.slice(0, max) : "";
const STATUSES = new Set<RequirementStatus>([
  "pendente",
  "parcial",
  "cumprida",
]);
const RESULTS = new Set<RoundResult>(["aberta", "exigencia", "positiva"]);

function requirementFrom(raw: unknown, round: number): Requirement | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = text(r.id, 80);
  if (!id) return null;
  const status = text(r.status) as RequirementStatus;
  return {
    id,
    ...(text(r.libraryId, 80) ? { libraryId: text(r.libraryId, 80) } : {}),
    title: text(r.title, 300),
    description: text(r.description),
    howToComply: text(r.howToComply),
    basis: text(r.basis, 1000),
    reference: text(r.reference, 200),
    status: STATUSES.has(status) ? status : "pendente",
    note: text(r.note),
    round:
      Number.isInteger(r.round) && (r.round as number) >= 1
        ? (r.round as number)
        : round,
    fromNewDocument: r.fromNewDocument === true,
    fromAi: r.fromAi === true,
    reviewed: r.reviewed === true,
    excerpt: text(r.excerpt, 2000),
  };
}

/** The qualificação as stored, every field checked. */
export function qualificationFrom(raw: unknown): QualificationData {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const attribution = isAttribution(text(r.attribution))
    ? (text(r.attribution) as Attribution)
    : "rcpn";
  const presenter = (
    r.presenter && typeof r.presenter === "object" ? r.presenter : {}
  ) as Record<string, unknown>;
  const rounds = (Array.isArray(r.rounds) ? r.rounds : [])
    .filter(
      (x): x is Record<string, unknown> => Boolean(x) && typeof x === "object",
    )
    .map((x, i) => {
      const n = Number.isInteger(x.n) ? (x.n as number) : i + 1;
      const result = text(x.result) as RoundResult;
      return {
        n,
        date: ISO_DAY.test(text(x.date)) ? text(x.date) : "",
        result: RESULTS.has(result) ? result : "aberta",
        newDocuments: text(x.newDocuments),
        aiNote: text(x.aiNote),
        requirements: (Array.isArray(x.requirements) ? x.requirements : [])
          .map((q) => requirementFrom(q, n))
          .filter((q): q is Requirement => q !== null),
      };
    });
  const receivedOn = ISO_DAY.test(text(r.receivedOn)) ? text(r.receivedOn) : "";
  return {
    attribution,
    act: text(r.act, 60),
    actOther: text(r.actOther, 200),
    presenter: {
      name: text(presenter.name, 300),
      document: text(presenter.document, 200),
      contact: text(presenter.contact, 300),
    },
    document: text(r.document, 2000),
    object: text(r.object),
    protocol: text(r.protocol, 60),
    receivedOn,
    fundamentals: (Array.isArray(r.fundamentals) ? r.fundamentals : [])
      .map((f) => text(f))
      .filter(Boolean)
      .slice(0, 30),
    observations: text(r.observations),
    rounds: rounds.length
      ? rounds
      : [
          {
            n: 1,
            date: receivedOn,
            result: "aberta",
            requirements: [],
            newDocuments: "",
            aiNote: "",
          },
        ],
  };
}

/**
 * A qualificação opened from a pedido of the online counter: the presenter,
 * the protocol, the day and the attribution come from it; the act asked is
 * named in the título, to be chosen among the attribution's acts.
 */
export function qualificationFromRequest(input: {
  protocol: string;
  applicantName: string;
  contact: string;
  /** ISO day the pedido came in. */
  receivedOn: string;
  /** The catalog's attribution ("RCPN", "RI"...). */
  attribution?: string;
  actName?: string;
}): QualificationData {
  const lower = (input.attribution ?? "").toLowerCase();
  const attribution: Attribution = isAttribution(lower) ? lower : "rcpn";
  const base = emptyQualification(attribution, input.receivedOn);
  return {
    ...base,
    presenter: {
      name: input.applicantName.slice(0, 300),
      document: "",
      contact: input.contact.slice(0, 300),
    },
    protocol: input.protocol.slice(0, 60),
    document: input.actName
      ? `Pedido de ${input.actName.toLowerCase()} pelo balcão online, com os documentos anexados.`
      : "",
  };
}
