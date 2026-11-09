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
      "Os emolumentos do registro ou da averbação são calculados depois da análise, pela tabela vigente, e informados no protocolo.",
  };
}
