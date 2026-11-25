import { CNM_PROBLEM_LABELS, type CnmBook, cnmProblems } from "./cnm.ts";
import { ACTIVE } from "./codes.ts";
import { indicatorGaps, propertyTitle, type RuralData } from "./property.ts";

/**
 * The pendências of the acervo while it migrates to fichas (CNN, Provimento
 * CNJ nº 149/2023, arts. 336 to 339) and before the cargas go to the ONR.
 * Each one says what to do, step by step, with the rule it comes from.
 */

export type PendencyKind =
  | "repetido"
  | "duplicidade"
  | "salto"
  | "cnm"
  | "indicador"
  | "proprietario";

export interface HowToStep {
  step: string;
  source: string;
}

export interface Pendency {
  kind: PendencyKind;
  /** The matrículas involved (ids), first the one to open. */
  ids: string[];
  title: string;
  detail: string;
}

export const PENDENCY_LABELS: Record<PendencyKind, string> = {
  repetido: "Mesmo número para imóveis diferentes (art. 338)",
  duplicidade:
    "Possível duplicidade: o mesmo imóvel em duas matrículas (art. 337)",
  salto: "Números sem matrícula cadastrada (art. 339)",
  cnm: "CNM ausente ou que não confere (art. 330)",
  indicador: "Faltam dados para o Indicador Real (Livro 4)",
  proprietario: "Matrícula ativa sem proprietário lançado",
};

export const PENDENCY_HOW_TO: Record<PendencyKind, HowToStep[]> = {
  repetido: [
    {
      step: "Confira nas fichas e nos livros qual das matrículas com o mesmo número foi aberta por último.",
      source: "CNN (Provimento CNJ nº 149/2023), art. 338",
    },
    {
      step: "Encerre de ofício a mais recente, por averbação, e abra outra matrícula para o mesmo imóvel com a data e a numeração atuais (no seu acervo, a próxima livre).",
      source: "CNN, art. 338",
    },
    {
      step: "Faça remissões recíprocas entre a matrícula encerrada e a nova, e lance a correlação no Indicador Real e no Indicador Pessoal.",
      source: "CNN, art. 338; Lei nº 6.015/1973, arts. 179 e 180",
    },
    {
      step: "No sistema: marque a encerrada com a situação 2 (Encerrada) e cadastre a nova. O lote de CNM leva as duas.",
      source: "PGV-CNM do ONR (CNN, art. 333)",
    },
  ],
  duplicidade: [
    {
      step: "Compare as duas matrículas: descrição, área, confrontações, CCIR, NIRF, CAR e a cadeia de títulos de cada uma.",
      source:
        "Lei nº 6.015/1973, art. 176, § 1º, I (cada imóvel, uma matrícula)",
    },
    {
      step: "Confirmada a duplicidade, represente ao juiz corregedor propondo o bloqueio das matrículas.",
      source: "CNN, art. 337",
    },
    {
      step: "Se for só o mesmo CCIR ou NIRF para imóveis diferentes (por exemplo, um desmembramento), anote nas observações e siga.",
      source: "CNN, art. 337",
    },
  ],
  salto: [
    {
      step: "Confira se o número ainda não foi migrado para o sistema ou se ficou mesmo sem uso no livro.",
      source: "CNN, art. 336",
    },
    {
      step: "Se ficou sem uso, insira ficha com uma averbação dizendo que deixou de ser aberta matrícula com esse número e que não existe imóvel matriculado.",
      source: "CNN, art. 339",
    },
    {
      step: "No sistema: cadastre o número com a situação 4 (Inexistente). Ele não volta a ser usado.",
      source: "CNN, arts. 332 e 339",
    },
  ],
  cnm: [
    {
      step: "Gere ou confira o CNM no PGV-CNM do ONR, entrando com o seu certificado digital.",
      source: "CNN, arts. 333 e 334",
    },
    {
      step: "Copie o CNM que o PGV devolveu para a matrícula. O cálculo do sistema serve para conferir; o que vale é o do PGV.",
      source: "CNN, art. 330, § 2º, e art. 333",
    },
    {
      step: "Lance o CNM no alto, à direita, do anverso e do verso de cada ficha.",
      source: "CNN, art. 331",
    },
  ],
  indicador: [
    {
      step: "Complete o tipo e o nome do logradouro. No imóvel rural sem endereço, use o tipo 177 (Não Especificado) e escreva a denominação da propriedade.",
      source: "Especificação do Indicador Real do ONR, v1.5, itens 4 e 9",
    },
    {
      step: "No imóvel rural, preencha também CCIR, NIRF, CAR, código do Incra e Sigef, quando houver: são as chaves de busca do SAEC.",
      source: "Provimento CNJ nº 143/2023, art. 15 (CNN, art. 342)",
    },
  ],
  proprietario: [
    {
      step: "Lance o ato de abertura (ou o último registro de transmissão) com os proprietários, CPF ou CNPJ e a fração de cada um.",
      source: "Lei nº 6.015/1973, art. 176, § 1º, II, 4",
    },
    {
      step: "Sem isso o Indicador Pessoal (Livro 5) não traz essa matrícula na busca por CPF.",
      source: "Lei nº 6.015/1973, art. 180",
    },
  ],
};

export interface PendencyProperty {
  id: string;
  book: CnmBook;
  number: number;
  recordKind: number;
  status: number;
  cnm: string;
  streetKind: number | null;
  street: string;
  rural: Pick<RuralData, "ccir" | "nirf" | "car" | "incra" | "sigef">;
  ownerCount: number;
}

/** Consecutive numbers as ranges: [1,2,3,7] → "1 a 3, 7". */
export function ranges(numbers: readonly number[]): string {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  const out: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  const push = () => {
    if (start === undefined || prev === undefined) return;
    out.push(
      start === prev
        ? start.toLocaleString("pt-BR")
        : `${start.toLocaleString("pt-BR")} a ${prev.toLocaleString("pt-BR")}`,
    );
  };
  for (const n of sorted.slice(1)) {
    if (n === (prev ?? 0) + 1) {
      prev = n;
      continue;
    }
    push();
    start = n;
    prev = n;
  }
  push();
  return out.join(", ");
}

const digitsOf = (value: string) => value.replace(/\W/g, "").toUpperCase();

/** Every pendência of the acervo, in the order the screen lists them. */
export function pendenciesOf(
  cns: string,
  properties: readonly PendencyProperty[],
): Pendency[] {
  const out: Pendency[] = [];
  const matriculas = properties.filter((p) => p.recordKind !== 4);

  // Art. 338: the same number for two imóveis.
  const byNumber = new Map<string, PendencyProperty[]>();
  for (const p of properties) {
    const key = `${p.recordKind === 4 ? "T" : p.book}:${p.number}`;
    byNumber.set(key, [...(byNumber.get(key) ?? []), p]);
  }
  for (const group of byNumber.values()) {
    if (group.length < 2) continue;
    out.push({
      kind: "repetido",
      ids: group.map((p) => p.id),
      title: `${propertyTitle(group[0])} aparece ${group.length} vezes`,
      detail:
        "Duas matrículas não podem ter o mesmo número, nem com letra (1-A, 1-B).",
    });
  }

  // Art. 337: the same rural key in two matrículas still active.
  const keys: (keyof PendencyProperty["rural"])[] = [
    "ccir",
    "nirf",
    "car",
    "incra",
    "sigef",
  ];
  const seen = new Set<string>();
  for (const key of keys) {
    const byKey = new Map<string, PendencyProperty[]>();
    for (const p of properties) {
      if (p.status !== ACTIVE) continue;
      const value = digitsOf(p.rural[key] ?? "");
      if (value.length < 4) continue;
      byKey.set(value, [...(byKey.get(value) ?? []), p]);
    }
    for (const [value, group] of byKey) {
      if (group.length < 2) continue;
      const ids = group.map((p) => p.id).sort();
      const mark = ids.join(",");
      if (seen.has(mark)) continue;
      seen.add(mark);
      out.push({
        kind: "duplicidade",
        ids: group.map((p) => p.id),
        title: `${group.map((p) => propertyTitle(p)).join(" e ")} têm o mesmo ${key.toUpperCase()}`,
        detail: `${key.toUpperCase()} ${value}: pode ser o mesmo imóvel matriculado duas vezes.`,
      });
    }
  }

  // Art. 339: numbers of the Livro 2 with no matrícula in the system.
  const used = matriculas.filter((p) => p.book === 2).map((p) => p.number);
  if (used.length > 0) {
    const max = Math.max(...used);
    const have = new Set(used);
    const missing: number[] = [];
    for (let n = 1; n <= max; n++) if (!have.has(n)) missing.push(n);
    if (missing.length > 0) {
      out.push({
        kind: "salto",
        ids: [],
        title: `${missing.length.toLocaleString("pt-BR")} ${missing.length === 1 ? "número" : "números"} do Livro 2 sem matrícula cadastrada`,
        detail: ranges(missing),
      });
    }
  }

  for (const p of properties) {
    if (p.recordKind === 4) continue;
    if (p.status === ACTIVE || p.cnm) {
      const problems = p.cnm
        ? cnmProblems(p.cnm, { cns, book: p.book, number: p.number })
        : [];
      if (!p.cnm || problems.length > 0) {
        out.push({
          kind: "cnm",
          ids: [p.id],
          title: `${propertyTitle(p)}: ${p.cnm ? "CNM não confere" : "sem CNM"}`,
          detail: p.cnm
            ? problems.map((problem) => CNM_PROBLEM_LABELS[problem]).join("; ")
            : "Gere o CNM no PGV-CNM e lance na matrícula.",
        });
      }
    }
  }

  for (const p of properties) {
    // The Livro 3 has no imóvel of its own nor owners (art. 177).
    if (p.status !== ACTIVE || p.book === 3) continue;
    const gaps = indicatorGaps(p);
    if (gaps.length > 0) {
      out.push({
        kind: "indicador",
        ids: [p.id],
        title: `${propertyTitle(p)}: falta ${gaps.join(" e ")}`,
        detail: "Sem isso o ONR recusa a linha no envio do Indicador Real.",
      });
    }
    if (p.ownerCount === 0) {
      out.push({
        kind: "proprietario",
        ids: [p.id],
        title: `${propertyTitle(p)}: sem proprietário lançado`,
        detail: "Lance a abertura ou o último registro com os proprietários.",
      });
    }
  }
  return out;
}
