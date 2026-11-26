import { integerInWords } from "../money/extenso.ts";
import type { RequerimentoSection } from "../request/requerimento.ts";

/**
 * The books of the Registro de Imóveis and their termos (change
 * registro-de-imoveis-livros), by the text of the Lei nº 6.015/1973 as
 * read on planalto.gov.br on 26/11/2026:
 *
 * - art. 4º: "Os livros de escrituração serão abertos, numerados,
 *   autenticados e encerrados pelo oficial do registro";
 * - art. 6º: in the Registro de Imóveis the number of the book is kept,
 *   "com a adição sucessiva de letras, na ordem alfabética simples, e,
 *   depois, repetidas em combinação com a primeira, com a segunda";
 * - art. 7º-A (Lei nº 14.382/2022): arts. 3º to 7º do not apply to the
 *   escrituração por meio eletrônico of art. 1º, § 3º;
 * - art. 173: the five books; parágrafo único: the Livros 2 to 5 "poderão
 *   ser substituídos por fichas";
 * - arts. 174 to 180: what each book is for;
 * - art. 184: "O Protocolo será encerrado diariamente";
 * - art. 210: the atos signed and closed by the oficial, the substituto
 *   legal or the escrevente designado and authorised by the juiz.
 *
 * The Código Nacional de Normas (Provimento CNJ nº 149/2023) has no model
 * of these termos for the Registro de Imóveis: the state's Código de
 * Normas may have one, and the office checks it.
 */

export type BookNumber = 1 | 2 | 3 | 4 | 5;
export const BOOK_NUMBERS: readonly BookNumber[] = [1, 2, 3, 4, 5];

export interface BookInfo {
  book: BookNumber;
  name: string;
  /** What it is for, in the words of the law. */
  purpose: string;
  source: string;
  /** What its items are called, for the range. */
  item: string;
  /** The same, in the plural: "matrículas a partir do nº 1". */
  items: string;
  /** Whether the law lets it be kept in fichas (art. 173, parágrafo único). */
  fichas: boolean;
}

export const BOOKS: Record<BookNumber, BookInfo> = {
  1: {
    book: 1,
    name: "Livro nº 1 · Protocolo",
    purpose:
      "apontamento de todos os títulos apresentados diariamente, ressalvado o disposto no parágrafo único do art. 12 da Lei nº 6.015/1973",
    source: "Lei nº 6.015/1973, arts. 173, I, 174, 175 e 184",
    item: "número de ordem",
    items: "números de ordem",
    fichas: false,
  },
  2: {
    book: 2,
    name: "Livro nº 2 · Registro Geral",
    purpose:
      "matrícula dos imóveis e registro ou averbação dos atos relacionados no art. 167 e não atribuídos ao Livro nº 3",
    source: "Lei nº 6.015/1973, arts. 173, II, e 176",
    item: "matrícula",
    items: "matrículas",
    fichas: true,
  },
  3: {
    book: 3,
    name: "Livro nº 3 · Registro Auxiliar",
    purpose:
      "registro dos atos que, sendo atribuídos ao Registro de Imóveis por disposição legal, não digam respeito diretamente a imóvel matriculado",
    source: "Lei nº 6.015/1973, arts. 173, III, 177 e 178",
    item: "registro",
    items: "registros",
    fichas: true,
  },
  4: {
    book: 4,
    name: "Livro nº 4 · Indicador Real",
    purpose:
      "repositório de todos os imóveis que figurarem nos demais livros, com sua identificação, referência aos números de ordem dos outros livros e anotações necessárias",
    source: "Lei nº 6.015/1973, arts. 173, IV, e 179",
    item: "ficha",
    items: "fichas",
    fichas: true,
  },
  5: {
    book: 5,
    name: "Livro nº 5 · Indicador Pessoal",
    purpose:
      "repositório, dividido alfabeticamente, dos nomes de todas as pessoas que, individual ou coletivamente, ativa ou passivamente, direta ou indiretamente, figurarem nos demais livros, com referência aos respectivos números de ordem",
    source: "Lei nº 6.015/1973, arts. 173, V, e 180",
    item: "ficha",
    items: "fichas",
    fichas: true,
  },
};

export function isBookNumber(value: number): value is BookNumber {
  return (
    value === 1 || value === 2 || value === 3 || value === 4 || value === 5
  );
}

/** How the book is kept. */
export type BookForm = "fichas" | "folhas" | "eletronico";
export const BOOK_FORMS: { id: BookForm; label: string; source: string }[] = [
  {
    id: "fichas",
    label: "Fichas soltas",
    source: "Lei nº 6.015/1973, art. 173, parágrafo único",
  },
  {
    id: "folhas",
    label: "Folhas (livro encadernado ou folhas soltas)",
    source: "Lei nº 6.015/1973, art. 3º, § 2º",
  },
  {
    id: "eletronico",
    label: "Meio eletrônico",
    source: "Lei nº 6.015/1973, arts. 1º, § 3º, e 7º-A",
  },
];

export function formLabel(form: string): string {
  return BOOK_FORMS.find((f) => f.id === form)?.label ?? form;
}

/**
 * The letters of art. 6º: "", A to Z, then AA, AB… (the letters again in
 * combination with the first, then with the second, and so on).
 */
export function volumeLetters(index: number): string {
  let n = Math.max(0, Math.floor(index));
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** "2", "2-A", "2-B"… */
export function volumeLabel(book: BookNumber, index: number): string {
  const letters = volumeLetters(index);
  return letters ? `${book}-${letters}` : String(book);
}

/** The volume the next book of that number takes, after the ones in use. */
export function nextVolume(book: BookNumber, used: readonly string[]): string {
  const taken = new Set(used.map((v) => v.trim().toUpperCase()));
  for (let i = 0; i < 10_000; i++) {
    const label = volumeLabel(book, i);
    if (!taken.has(label)) return label;
  }
  return `${book}-?`;
}

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
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

/** "26 de novembro de 2026". */
export function writtenDate(iso: string): string {
  return `${Number(iso.slice(8, 10))} de ${MONTHS[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}`;
}

/** "26/11/2026". */
export function shortDate(iso: string | null | undefined): string {
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "";
}

/** Folhas and fichas are feminine: "duzentas e uma folhas". */
export function feminineInWords(n: number): string {
  return integerInWords(n)
    .replace(/\bum\b/g, "uma")
    .replace(/\bdois\b/g, "duas")
    .replace(/entos\b/g, "entas");
}

const counted = (n: number) =>
  `${n.toLocaleString("pt-BR")} (${feminineInWords(n)})`;

export interface BookRecord {
  book: BookNumber;
  volume: string;
  form: BookForm;
  /** Folhas or fichas the book has; 0 when it has no fixed number. */
  sheetCount: number;
  firstItem: number | null;
  lastItem: number | null;
  openedOn: string;
  closedOn: string | null;
  /** The last folha or ficha written, at the closing. */
  lastSheet: number | null;
  openingNotes: string;
  closingNotes: string;
}

export interface TermOffice {
  name: string;
  cns: string;
  city: string;
  state: string;
}

export interface TermText {
  eyebrow: string;
  title: string;
  subtitle: string;
  sections: RequerimentoSection[];
  dateLine: string;
}

function range(r: BookRecord, info: BookInfo): string {
  if (r.firstItem === null) return "";
  return r.lastItem === null
    ? `${info.items} a partir do nº ${r.firstItem.toLocaleString("pt-BR")}`
    : `${info.items} do nº ${r.firstItem.toLocaleString("pt-BR")} ao nº ${r.lastItem.toLocaleString("pt-BR")}`;
}

/** The units the book is counted in. */
function units(form: BookForm): string {
  return form === "fichas" ? "fichas" : "folhas";
}

/**
 * The termo de abertura (art. 4º): the book, what it is for, how many
 * folhas or fichas it has, that they are numbered and autenticadas, and
 * the closing with the date and who signs (art. 210).
 */
export function openingTerm(r: BookRecord, office: TermOffice): TermText {
  const info = BOOKS[r.book];
  const where = `${office.city}/${office.state}`;
  const electronic = r.form === "eletronico";
  const size = r.sheetCount ? `${counted(r.sheetCount)} ${units(r.form)}` : "";
  const named = `${info.name.replace(" · ", ", ")}${r.volume === String(r.book) ? "" : `, volume ${r.volume}`}`;
  const body = electronic
    ? `Fica aberto, em meio eletrônico, o ${named}, da serventia ${office.name}, CNS ${office.cns}. Os atos serão escriturados e conservados em meio eletrônico e assinados com certificado digital ICP-Brasil, na forma do art. 1º, § 3º, da Lei nº 6.015/1973. Finalidade: ${info.purpose} (${info.source}).`
    : `Fica aberto o ${named}, da serventia ${office.name}, CNS ${office.cns}. ${size ? `Contém ${size}, numeradas e autenticadas pelo oficial.` : "Suas folhas ou fichas serão numeradas e autenticadas pelo oficial à medida que forem usadas."} Finalidade: ${info.purpose} (${info.source}).`;
  const rows = [
    { label: "Livro", value: `${info.name} · ${r.volume}` },
    { label: "Forma de escrituração", value: formLabel(r.form) },
    ...(size ? [{ label: "Número de folhas ou fichas", value: size }] : []),
    ...(range(r, info)
      ? [{ label: "Abrangência", value: range(r, info) }]
      : []),
    { label: "Fundamento", value: info.source },
  ];
  return {
    eyebrow: "Registro de Imóveis",
    title: "Termo de abertura",
    subtitle: `${info.name} · ${r.volume}`,
    sections: [
      { heading: "Livro", rows },
      {
        heading: "Termo",
        paragraphs: [
          body,
          electronic
            ? "Na escrituração eletrônica não se aplicam os arts. 3º a 7º da Lei nº 6.015/1973 (art. 7º-A); este termo fica como registro de controle da serventia."
            : "Termo lavrado nos termos do art. 4º da Lei nº 6.015/1973: os livros de escrituração são abertos, numerados, autenticados e encerrados pelo oficial do registro.",
          ...(r.openingNotes.trim() ? [r.openingNotes.trim()] : []),
        ],
      },
    ],
    dateLine: `${where}, ${writtenDate(r.openedOn)}.`,
  };
}

/** The termo de encerramento (art. 4º): what was written and until where. */
export function closingTerm(r: BookRecord, office: TermOffice): TermText {
  const info = BOOKS[r.book];
  const closed = r.closedOn ?? r.openedOn;
  const where = `${office.city}/${office.state}`;
  const used = r.lastSheet
    ? `, escriturado até a ${r.form === "fichas" ? "ficha" : "folha"} nº ${r.lastSheet.toLocaleString("pt-BR")}`
    : "";
  const span = range(r, info);
  return {
    eyebrow: "Registro de Imóveis",
    title: "Termo de encerramento",
    subtitle: `${info.name} · ${r.volume}`,
    sections: [
      {
        heading: "Livro",
        rows: [
          { label: "Livro", value: `${info.name} · ${r.volume}` },
          { label: "Forma de escrituração", value: formLabel(r.form) },
          { label: "Aberto em", value: shortDate(r.openedOn) },
          { label: "Encerrado em", value: shortDate(closed) },
          ...(r.sheetCount
            ? [
                {
                  label: "Número de folhas ou fichas",
                  value: counted(r.sheetCount),
                },
              ]
            : []),
          ...(r.lastSheet
            ? [
                {
                  label: "Última folha ou ficha escriturada",
                  value: r.lastSheet.toLocaleString("pt-BR"),
                },
              ]
            : []),
          ...(span ? [{ label: "Abrangência", value: span }] : []),
        ],
      },
      {
        heading: "Termo",
        paragraphs: [
          `Encerra-se o ${info.name.replace(" · ", ", ")}${r.volume === String(r.book) ? "" : `, volume ${r.volume}`}, da serventia ${office.name}, CNS ${office.cns}, aberto em ${shortDate(r.openedOn)}${used}${span ? `, ${span}` : ""}. A escrituração continua no livro seguinte, que conserva o número com a letra seguinte (Lei nº 6.015/1973, art. 6º).`,
          ...(r.closingNotes.trim() ? [r.closingNotes.trim()] : []),
        ],
      },
    ],
    dateLine: `${where}, ${writtenDate(closed)}.`,
  };
}

/** A título of the Protocolo, as art. 175 lists its columns. */
export interface ProtocolLine {
  number: number;
  presentedOn: string;
  presenter: string;
  titleKind: string;
  acts: string;
  /** Lançado por engano: kept in its order, marked. */
  voided: boolean;
}

/**
 * The Protocolo of one day and its encerramento (art. 184: "O Protocolo
 * será encerrado diariamente"): the títulos in the order they were
 * apontados, with the five columns of art. 175, and the closing line.
 * Títulos for exame e cálculo are not apontados (art. 12, parágrafo único).
 */
export function protocolDay(
  day: string,
  lines: readonly ProtocolLine[],
): RequerimentoSection[] {
  const sorted = [...lines].sort((a, b) => a.number - b.number);
  const valid = sorted.filter((l) => !l.voided);
  const rows = sorted.map((l) => ({
    label: `Nº ${l.number.toLocaleString("pt-BR")}`,
    value: [
      `Apresentado em ${shortDate(l.presentedOn)} por ${l.presenter}`,
      l.titleKind,
      l.acts,
      l.voided ? "LANÇADO POR ENGANO (sem efeito)" : "",
    ]
      .filter(Boolean)
      .join(" · "),
  }));
  const first = valid[0]?.number;
  const last = valid.at(-1)?.number;
  const closing =
    valid.length === 0
      ? `Encerra-se o Protocolo do dia ${shortDate(day)} sem apresentação de títulos.`
      : `Encerra-se o Protocolo do dia ${shortDate(day)} com ${valid.length} (${integerInWords(valid.length)}) ${valid.length === 1 ? "título apontado" : "títulos apontados"}, ${first === last ? `sob o nº ${first?.toLocaleString("pt-BR")}` : `do nº ${first?.toLocaleString("pt-BR")} ao nº ${last?.toLocaleString("pt-BR")}`}.`;
  return [
    ...(rows.length
      ? [{ heading: `Títulos apontados em ${shortDate(day)}`, rows }]
      : []),
    {
      heading: "Encerramento do dia",
      paragraphs: [
        closing,
        "Lei nº 6.015/1973, art. 184: o Protocolo será encerrado diariamente.",
      ],
    },
  ];
}

/** Whole numbers only; empty is null. */
export function readItem(raw: string): number | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}

/** The fichas of a book in batches the assinador takes at once. */
export function batches<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
