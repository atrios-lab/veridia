import { deadlineDate } from "../request/deadline.ts";
import type { OfficeHolidays } from "../scheduling/calendar.ts";
import type { Owner, Situation } from "./acts.ts";

/**
 * The Protocolo (Livro 1) of the Registro de Imóveis: every título
 * presented takes the next order number, which sets its priority (Lei nº
 * 6.015/1973, arts. 174, 175, 182 and 186). The prazos run in dias úteis
 * (art. 9º, § 1º): the qualification in 10 (art. 188; 5 in the cases of its
 * § 1º), the prenotação's effects in 20 (art. 205; 40 in the Reurb of
 * interesse social). A título only for exame e cálculo is not apontado in
 * the Livro 1 (art. 12, parágrafo único): it has its own numbering here.
 */

export const TITLE_KINDS: readonly { name: string; source: string }[] = [
  { name: "Escritura pública", source: "Lei nº 6.015/1973, art. 221, I" },
  {
    name: "Instrumento particular autorizado em lei",
    source: "art. 221, II",
  },
  {
    name: "Título judicial (carta de sentença, formal de partilha, mandado, certidão)",
    source: "art. 221, IV",
  },
  {
    name: "Contrato ou termo administrativo (regularização, habitação social, desapropriação)",
    source: "art. 221, V e VI",
  },
  { name: "Título estrangeiro", source: "art. 221, III" },
  { name: "Cédula de crédito", source: "lei específica da cédula" },
  {
    name: "Extrato eletrônico (SERP)",
    source: "CNN, arts. 210-A a 210-Q",
  },
  { name: "Requerimento", source: "Lei nº 6.015/1973, art. 13, II" },
];

export type ProtocolKind = "prenotacao" | "exame";

export type ProtocolStatus =
  | "prenotado"
  | "exigencia"
  | "registrado"
  | "cessado"
  | "desistencia"
  | "duvida"
  | "exame-concluido";

export const PROTOCOL_STATUS_LABELS: Record<ProtocolStatus, string> = {
  prenotado: "Prenotado: a qualificar",
  exigencia: "Em exigência (nota devolutiva)",
  registrado: "Registrado",
  cessado: "Prenotação cessada",
  desistencia: "Desistência",
  duvida: "Dúvida suscitada",
  "exame-concluido": "Exame e cálculo concluído",
};

/** The statuses in which the prazos still run. */
export const OPEN_STATUSES: readonly ProtocolStatus[] = [
  "prenotado",
  "exigencia",
  "duvida",
];

export interface Deadlines {
  /** Last day to register or issue the nota devolutiva (art. 188). */
  qualifyBy: string;
  /** Last day of the prenotação's effects (art. 205). */
  prenotationEnds: string;
}

/**
 * The prazos of a título presented on `presentedOn` (aaaa-mm-dd), in dias
 * úteis of the office. `fast`: one of the cases of art. 188, § 1º (5 dias);
 * `reurb`: Reurb of interesse social (art. 205, parágrafo único, 40 dias).
 */
export function deadlinesFor(
  presentedOn: string,
  options: { fast?: boolean; reurb?: boolean },
  holidays: OfficeHolidays = {},
): Deadlines {
  return {
    qualifyBy: deadlineDate(presentedOn, options.fast ? 5 : 10, holidays),
    prenotationEnds: deadlineDate(
      presentedOn,
      options.reurb ? 40 : 20,
      holidays,
    ),
  };
}

export type Urgency = "vencido" | "hoje" | "amanha" | "no-prazo";

/** How close a prazo is, against today (both aaaa-mm-dd). */
export function urgencyOf(
  due: string,
  today: string,
  tomorrow: string,
): Urgency {
  if (due < today) return "vencido";
  if (due === today) return "hoje";
  if (due === tomorrow) return "amanha";
  return "no-prazo";
}

/** The next order number: indefinitely, in the same series (art. 175, I). */
export function nextProtocolNumber(numbers: readonly number[]): number {
  return numbers.reduce((max, n) => Math.max(max, n), 0) + 1;
}

const fold = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

const samePerson = (
  a: { name: string; document: string },
  b: { name: string; document: string },
) =>
  a.document && b.document
    ? a.document.replace(/\D/g, "") === b.document.replace(/\D/g, "")
    : fold(a.name) === fold(b.name);

export interface Check {
  ok: boolean;
  text: string;
  source: string;
}

/**
 * What can be checked against the matrícula without judgment: the
 * outorgante is the owner of record (continuidade, arts. 195 and 237), and
 * the ônus in force (disponibilidade). The rest of the qualification is
 * the oficial's.
 */
export function registryChecks(
  situation: Pick<Situation, "owners" | "burdens" | "closed">,
  transmitters: { name: string; document: string }[],
): Check[] {
  const out: Check[] = [];
  if (situation.closed) {
    out.push({
      ok: false,
      text: "A matrícula está encerrada: o ato vai na matrícula que a sucedeu.",
      source: "Lei nº 6.015/1973, art. 233",
    });
  }
  if (transmitters.length > 0) {
    const missing = transmitters.filter(
      (t) => !situation.owners.some((o: Owner) => samePerson(o, t)),
    );
    out.push(
      missing.length === 0
        ? {
            ok: true,
            text: "Quem transmite é o proprietário que está na matrícula.",
            source: "Lei nº 6.015/1973, arts. 195 e 237 (continuidade)",
          }
        : {
            ok: false,
            text: `${missing.map((m) => m.name).join(", ")} não ${missing.length > 1 ? "aparecem" : "aparece"} como proprietário(s) na matrícula: exija o registro do título anterior.`,
            source: "Lei nº 6.015/1973, arts. 195 e 237 (continuidade)",
          },
    );
  }
  const unavailable = situation.burdens.filter((b) =>
    /indisponib/i.test(b.nature),
  );
  if (unavailable.length > 0) {
    out.push({
      ok: false,
      text: `Há indisponibilidade em vigor (${unavailable.map((b) => b.label).join(", ")}): confira a ordem e a CNIB antes de registrar alienação ou oneração.`,
      source: "Lei nº 6.015/1973, art. 247; CNN, arts. 320-A a 320-F (CNIB)",
    });
  }
  const others = situation.burdens.filter((b) => !/indisponib/i.test(b.nature));
  if (others.length > 0) {
    out.push({
      ok: true,
      text: `Ônus em vigor: ${others.map((b) => `${b.label} ${b.nature}`).join("; ")}. Não impedem o registro, mas o adquirente recebe o imóvel com eles.`,
      source: "Lei nº 6.015/1973, art. 176, § 1º, III",
    });
  }
  // Every ato, every time: the CNIB has to be consulted (CNN, art. 320-F).
  out.push({
    ok: true,
    text: "Consulte a CNIB em nome de quem transmite ou onera antes de praticar o ato, e guarde o resultado.",
    source: "CNN (Provimento CNJ nº 149/2023), art. 320-F",
  });
  return out;
}

export interface Requirement {
  text: string;
  source: string;
}

/**
 * The nota devolutiva: every exigência at once, articulated, clear, with
 * date and who signs (art. 198); what the apresentante may do (satisfy it,
 * or ask for the dúvida, art. 198, V and VI); and when the prenotação ends
 * (art. 205).
 */
export function requirementNote(input: {
  protocolNumber: number;
  presentedOn: string;
  titleKind: string;
  presenter: string;
  requirements: Requirement[];
  prenotationEnds: string;
}): { heading: string; paragraphs: string[] }[] {
  const br = (iso: string) => iso.split("-").reverse().join("/");
  return [
    {
      heading: "Título",
      paragraphs: [
        `Protocolo nº ${input.protocolNumber.toLocaleString("pt-BR")}, apresentado em ${br(input.presentedOn)} por ${input.presenter}. Natureza: ${input.titleKind}.`,
      ],
    },
    {
      heading: "Exigências",
      paragraphs: input.requirements.map(
        (r, i) => `${i + 1}. ${r.text}${r.source ? ` (${r.source})` : ""}`,
      ),
    },
    {
      heading: "O que fazer",
      paragraphs: [
        "Cumpra as exigências acima e reapresente o título dentro do prazo da prenotação; o registro é feito em até 5 dias úteis depois do reingresso com todas cumpridas (Lei nº 6.015/1973, art. 188, § 1º, III).",
        `A prenotação vale até ${br(input.prenotationEnds)}. Depois disso, sem o cumprimento, seus efeitos cessam (art. 205), e o título perde a prioridade.`,
        "Se não concordar com alguma exigência, ou não puder cumpri-la, você pode requerer que o título e a declaração de dúvida sejam remetidos ao juiz competente (art. 198, VI).",
      ],
    },
  ];
}
