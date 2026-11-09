import { z } from "zod";

/**
 * The prenotação: the entry of a title in the protocol of Registro de
 * Imóveis, Títulos e Documentos or Pessoas Jurídicas, which starts the
 * analysis (qualificação) and fixes the order of presentation (Lei
 * 6.015/1973, arts. 12, 182 and 186 for Imóveis; art. 146 for Títulos e
 * Documentos). The fee table prices it as an item of its own, and that item
 * is what a request for analysis charges up front.
 *
 * What it costs is never typed here: it comes from the fee table the office
 * marks as current, read from its PDF or entered by hand in the panel, and is
 * always the item's total.
 */

export const PRENOTATION_ATTRIBUTIONS = ["RI", "RTD", "RCPJ"] as const;
export type PrenotationAttribution = (typeof PRENOTATION_ATTRIBUTIONS)[number];

export const PRENOTATION_LABELS: Record<PrenotationAttribution, string> = {
  RI: "Registro de Imóveis",
  RTD: "Registro de Títulos e Documentos",
  RCPJ: "Registro Civil das Pessoas Jurídicas",
};

export function isPrenotationAttribution(
  value: unknown,
): value is PrenotationAttribution {
  return (PRENOTATION_ATTRIBUTIONS as readonly unknown[]).includes(value);
}

export const feeItemSchema = z.object({
  /** The table's own code, "2600103". */
  code: z
    .string()
    .trim()
    .regex(/^[0-9][0-9.\-/]{2,19}$/, "Informe o código como está na tabela."),
  description: z.string().trim().min(1, "Informe a descrição do item."),
  /** The item's total, in cents: what the citizen pays. */
  totalCents: z
    .number()
    .int()
    .positive("O total precisa ser maior que zero.")
    .max(10_000_000, "Confira o total: está alto demais para uma prenotação."),
});
export type FeeItem = z.infer<typeof feeItemSchema>;

export const prenotationItemsSchema = z.object({
  RI: feeItemSchema.optional(),
  RTD: feeItemSchema.optional(),
  RCPJ: feeItemSchema.optional(),
});
export type PrenotationItems = z.infer<typeof prenotationItemsSchema>;

/** "57,90" or "1.234,56" or "R$ 57,90" as cents; undefined when it is not
 * money. */
export function parseMoney(text: string): number | undefined {
  const match = text
    .trim()
    .match(/^(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})$/);
  if (!match) return undefined;
  return Number(match[1].replace(/\./g, "")) * 100 + Number(match[2]);
}

/** 5790 as "R$ 57,90". */
export function formatMoney(cents: number): string {
  const reais = Math.floor(cents / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${reais},${String(cents % 100).padStart(2, "0")}`;
}

function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Which attribution a heading of the table opens, if it opens one. */
function sectionOf(line: string): PrenotationAttribution | "other" | undefined {
  const folded = fold(line);
  if (/registro de imoveis|imoveis/.test(folded) && !/prenot/.test(folded)) {
    return "RI";
  }
  if (/titulos e documentos/.test(folded) && !/prenot/.test(folded)) {
    return "RTD";
  }
  if (/pessoas? juridicas?/.test(folded) && !/prenot/.test(folded)) {
    return "RCPJ";
  }
  if (
    /tabelionato de notas|tabelionato de protesto|pessoas naturais|registro civil das pessoas naturais/.test(
      folded,
    )
  ) {
    return "other";
  }
  return undefined;
}

/** The attribution a prenotação line names by itself, when it does. */
function attributionInLine(line: string): PrenotationAttribution | undefined {
  const folded = fold(line);
  if (/imove/.test(folded)) return "RI";
  if (/titulos e documentos|\brtd\b/.test(folded)) return "RTD";
  if (/juridic|\brcpj\b/.test(folded)) return "RCPJ";
  return undefined;
}

const CODE = /\b(\d{7})\b/;
const MONEY = /(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}/g;

/**
 * Finds the prenotação items in the text of a fee table: for each of
 * Imóveis, Títulos e Documentos and Pessoas Jurídicas, the line that names a
 * prenotação, its 7-digit code and its total (the last amount on the line,
 * which is how the tables lay out emolumento, funds and total). The
 * attribution comes from the line itself or, failing that, from the section
 * heading above it. A code or total that wrapped to the next line is looked
 * for there too.
 *
 * Best effort by design: the result goes to the office to confirm in the
 * panel, never straight to a citizen's bill without that screen.
 */
export function findPrenotationItems(text: string): PrenotationItems {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const found: PrenotationItems = {};
  let section: PrenotationAttribution | "other" | undefined;

  lines.forEach((line, index) => {
    const opened = sectionOf(line);
    if (opened) section = opened;
    if (!/prenota/i.test(fold(line))) return;

    const attribution =
      attributionInLine(line) ?? (section !== "other" ? section : undefined);
    if (!attribution || found[attribution]) return;

    const around = [line, lines[index + 1] ?? ""];
    const code = around.join(" ").match(CODE)?.[1];
    const amounts = (line.match(MONEY) ?? lines[index + 1]?.match(MONEY) ?? [])
      .map(parseMoney)
      .filter((value): value is number => value !== undefined);
    const total = amounts.at(-1);
    if (!code || !total) return;

    const description = line
      .replace(CODE, "")
      .replace(MONEY, "")
      .replace(/\s+/g, " ")
      .replace(/^[\s\-\u2013:.|]+|[\s\-\u2013:.|]+$/g, "")
      .trim();
    found[attribution] = {
      code,
      description: description || "Prenotação",
      totalCents: total,
    };
  });
  return found;
}

/**
 * The codes each state's table gives the three prenotações, as the offices
 * confirmed them. Reading by the code is what keeps a neighbouring item (a
 * prenotação of another registry, a testamento's) from being taken for it;
 * the headings are only the fallback for a table whose codes changed.
 */
export const PRENOTATION_CODES: Partial<
  Record<string, Record<PrenotationAttribution, string>>
> = {
  RN: { RI: "2600103", RTD: "2500140", RCPJ: "2400105" },
};

export function prenotationCodesFor(
  state: string,
): Record<PrenotationAttribution, string> | undefined {
  return PRENOTATION_CODES[state];
}

/**
 * How sure the total is: "sum" when the amounts before it add up to it (the
 * table's emolumento plus funds), "single" when the row has one amount only,
 * "unchecked" when the parts and the last amount disagree, which means the
 * last amount may not be the total at all.
 */
export type AmountCheck = "sum" | "single" | "unchecked";

export interface ReadFeeItem extends FeeItem {
  /** "code": the row of the code the state's table uses for it; "section":
   * guessed from a heading, for a table whose code is not the known one. */
  foundBy: "code" | "section";
  check: AmountCheck;
}
export type ReadPrenotation = Partial<
  Record<PrenotationAttribution, ReadFeeItem>
>;

/** Read well enough to charge without anyone looking first. Anything else
 * waits for the office on the table's screen. */
export function isTrustedRead(item: ReadFeeItem): boolean {
  return item.foundBy === "code" && item.check !== "unchecked";
}

function amountsOf(text: string): number[] {
  return (text.match(MONEY) ?? [])
    .map(parseMoney)
    .filter((value): value is number => value !== undefined);
}

function checkOf(amounts: number[]): AmountCheck {
  if (amounts.length === 1) return "single";
  const total = amounts.at(-1) ?? 0;
  const parts = amounts.slice(0, -1).reduce((sum, value) => sum + value, 0);
  // Each part is rounded on its own: a cent per part is rounding, more is a
  // different column.
  return Math.abs(parts - total) <= amounts.length - 1 ? "sum" : "unchecked";
}

/** A 7-digit code standing alone, not part of a longer number or amount. */
const ANY_CODE = /(?<![\d.,/])\d{7}(?![\d.,/])/;

/**
 * The item a code names, read from the rows of the table: from the code to
 * the next code on the same row (two items side by side), and, when the
 * amounts are not on that row (a tall cell), the rows right below or above
 * it, never past another item's code.
 */
function itemByCode(
  rows: string[],
  code: string,
  foundBy: ReadFeeItem["foundBy"],
): ReadFeeItem | undefined {
  const own = new RegExp(`(?<![\\d.,/])${code}(?![\\d.,/])`);
  const candidates: { text: string; amounts: number[]; score: number }[] = [];
  rows.forEach((row, index) => {
    const at = row.search(own);
    if (at < 0) return;
    let rest = row.slice(at + code.length);
    const next = rest.search(ANY_CODE);
    if (next >= 0) rest = rest.slice(0, next);
    let text = rest;
    let amounts = amountsOf(rest);
    for (const step of [1, -1]) {
      for (let k = 1; amounts.length === 0 && k <= 3; k++) {
        const near = rows[index + step * k];
        if (near === undefined || ANY_CODE.test(near)) break;
        const found = amountsOf(near);
        if (found.length > 0) {
          amounts = found;
          text = step > 0 ? `${rest} ${near}` : `${near} ${rest}`;
        } else if (step > 0) {
          rest = `${rest} ${near}`;
        }
      }
    }
    if (amounts.length === 0) return;
    // The code can also be cited in a note. The item itself is the one a
    // row (or a cell, after another item) starts with, that says
    // "prenotação" and whose parts add up to its total.
    const before = row.slice(0, at);
    const opensCell = before.trim() === "" || /\d,\d{2}\s*$/.test(before);
    const score =
      (opensCell ? 4 : 0) +
      (/prenota/.test(fold(text)) ? 2 : 0) +
      (checkOf(amounts) === "sum" ? 1 : 0);
    candidates.push({ text, amounts, score });
  });
  const chosen = candidates.reduce<(typeof candidates)[number] | undefined>(
    (best, candidate) =>
      !best || candidate.score > best.score ? candidate : best,
    undefined,
  );
  if (!chosen) return undefined;
  const description = chosen.text
    .replace(MONEY, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-\u2013:.|]+|[\s\-\u2013:.|]+$/g, "")
    .trim()
    .slice(0, 200);
  return {
    code,
    description: description || "Prenotação",
    totalCents: chosen.amounts.at(-1) ?? 0,
    foundBy,
    check: checkOf(chosen.amounts),
  };
}

/**
 * The prenotações of a fee table, read by the codes the state's table uses
 * (`codes`) and, for a registry whose code is not in the table, by the
 * section headings. Each item says how it was found and whether its total
 * adds up, so nothing doubtful is charged before the office confirms it.
 */
export function readPrenotationTable(
  text: string,
  codes?: Record<PrenotationAttribution, string>,
): ReadPrenotation {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const guessed = findPrenotationItems(text);
  const read: ReadPrenotation = {};
  for (const attribution of PRENOTATION_ATTRIBUTIONS) {
    const code = codes?.[attribution];
    const byCode = code ? itemByCode(rows, code, "code") : undefined;
    if (byCode) {
      read[attribution] = byCode;
      continue;
    }
    const guess = guessed[attribution];
    if (!guess) continue;
    read[attribution] = itemByCode(rows, guess.code, "section") ?? {
      ...guess,
      foundBy: "section",
      check: "unchecked",
    };
  }
  return read;
}

/**
 * What the request form and the success screen say about the price, so
 * nobody reads the prenotação as the price of the registration itself.
 */
export function prenotationNotice(
  item: FeeItem,
  tableTitle: string,
): { headline: string; detail: string } {
  return {
    headline: `Prenotação: ${formatMoney(item.totalCents)} (código ${item.code} da ${tableTitle})`,
    detail:
      "Este valor é a prenotação: a entrada do título no protocolo para a análise, cobrada agora. " +
      "Os emolumentos do ato (anotação, averbação, registro, retificação ou ratificação) são calculados depois da análise, pela tabela vigente, e informados no protocolo.",
  };
}
