import type { ReadAct } from "./matricula-text.ts";

/**
 * What a signed ficha changes in the acervo (change
 * registro-de-imoveis-livro-digital): the ficha is read and set against
 * the matrícula as the system has it. An ato with a número de ordem the
 * matrícula does not have yet is a new registro (R) or averbação (AV); an
 * ato it has, with another text, is a retificação of what was lançado.
 * The office confirms before anything goes in.
 */

export interface KnownAct {
  seq: number;
  kind: string;
  nature: string;
  summary: string;
  registeredOn: string | null;
}

export type ChangeKind =
  | "nova-matricula"
  | "novo-registro"
  | "nova-averbacao"
  | "retificacao";

export interface FichaChange {
  kind: ChangeKind;
  seq: number | null;
  label: string;
  /** Retificação: the text as it was lançado. */
  before?: string;
  after?: string;
}

/** Spaces, case and punctuation aside: the same text. */
const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();

export const CHANGE_LABELS: Record<ChangeKind, string> = {
  "nova-matricula": "Matrícula nova no acervo",
  "novo-registro": "Novo registro",
  "nova-averbacao": "Nova averbação",
  retificacao: "Retificação de ato já lançado",
};

export function compareFicha(input: {
  exists: boolean;
  number: number;
  known: readonly KnownAct[];
  read: readonly ReadAct[];
}): FichaChange[] {
  const n = input.number.toLocaleString("pt-BR");
  if (!input.exists) {
    return [
      {
        kind: "nova-matricula",
        seq: null,
        label: `Matrícula nº ${n} entra no acervo com ${input.read.length} ${input.read.length === 1 ? "ato" : "atos"}`,
      },
    ];
  }
  const bySeq = new Map(input.known.map((a) => [a.seq, a]));
  const out: FichaChange[] = [];
  for (const act of [...input.read].sort((a, b) => a.seq - b.seq)) {
    const label = `${act.kind}-${act.seq}-${n}${act.nature ? ` (${act.nature})` : ""}`;
    const own = bySeq.get(act.seq);
    if (!own) {
      out.push({
        kind: act.kind === "R" ? "novo-registro" : "nova-averbacao",
        seq: act.seq,
        label,
      });
    } else if (act.summary.trim() && fold(own.summary) !== fold(act.summary)) {
      out.push({
        kind: "retificacao",
        seq: act.seq,
        label,
        before: own.summary,
        after: act.summary,
      });
    }
  }
  return out;
}

/**
 * The date of the averbação de transporte (CNN, art. 336: the matrícula
 * carried from the livro encadernado to the fichas), the date the Livro 2
 * in fichas opens with. Without one, the opening date of the matrícula.
 */
export function transportDate(reading: {
  openedOn: string | null;
  acts: readonly Pick<
    ReadAct,
    "kind" | "nature" | "summary" | "registeredOn"
  >[];
}): { date: string | null; fromTransport: boolean } {
  const transport = reading.acts.find(
    (a) =>
      a.kind === "AV" &&
      /transport/i.test(`${a.nature} ${a.summary}`) &&
      a.registeredOn,
  );
  if (transport?.registeredOn) {
    return { date: transport.registeredOn, fromTransport: true };
  }
  return { date: reading.openedOn, fromTransport: false };
}
