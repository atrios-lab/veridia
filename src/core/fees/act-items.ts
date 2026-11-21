/**
 * The items of a fee table that price the acts of a cédula (decision of
 * 21/11/2026: "a cobrança é averbação sem conteúdo econômico (código
 * 2500135)"): found in the table's text, one row per line, by what the
 * description says. Best effort by design: the clerk is told the code and
 * asked to confirm it is the item of the right registry.
 */

export type ActItemKind =
  | "registro-com-valor"
  | "averbacao-com-valor"
  | "averbacao-sem-valor";

export interface ActItem {
  code: string;
  description: string;
  /** The row's last amount (the total); 0 when the row has none. */
  totalCents: number;
  /** The registry heading the item sits under, when there is one. */
  section: "RI" | "RTD" | "outro" | null;
}

function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const CODE = /(?<![\d.,/])(\d{7})(?![\d.,/])/;
const MONEY = /(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}/g;

function cents(value: string): number {
  const m = /(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})/.exec(value);
  return m?.[1] && m[2]
    ? Number(m[1].replace(/\./g, "")) * 100 + Number(m[2])
    : 0;
}

const WITHOUT_VALUE =
  /sem (conteudo|valor|expressao)( economic| financeir| declarad| monetari)?|sem valor declarado|sem conteudo/;
const WITH_VALUE =
  /com (conteudo|valor|expressao)( economic| financeir| declarad| monetari)?|com valor declarado|com conteudo/;

/** What kind of cédula act a description prices, if any. */
export function actItemKind(description: string): ActItemKind | null {
  const d = fold(description);
  if (/prenota|certid|busca|cancelamento/.test(d)) return null;
  const without = WITHOUT_VALUE.test(d);
  const withValue = !without && WITH_VALUE.test(d);
  if (/averba/.test(d)) {
    if (without) return "averbacao-sem-valor";
    if (withValue) return "averbacao-com-valor";
    return null;
  }
  if (/registro|registra/.test(d) && withValue) return "registro-com-valor";
  return null;
}

/**
 * The cédula items of a fee table's text. An item is a row that starts
 * with (or holds) a 7-digit code, with the rows below it until the next
 * code, so a description that wrapped stays whole. Items under the Registro
 * de Imóveis heading come first.
 */
export function findActItems(
  text: string,
): Partial<Record<ActItemKind, ActItem[]>> {
  const rows = text
    .split(/\r?\n/)
    .map((row) => row.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const items: { code: string; text: string; section: ActItem["section"] }[] =
    [];
  let section: ActItem["section"] = null;
  for (const row of rows) {
    const code = CODE.exec(row)?.[1];
    if (!code) {
      const folded = fold(row);
      if (/^registro de imoveis|^(do |dos )?registro de imoveis/.test(folded)) {
        section = "RI";
      } else if (/titulos e documentos/.test(folded) && !/\d,\d{2}/.test(row)) {
        section = "RTD";
      } else if (
        /^(tabelionato|registro civil|pessoas juridicas|protesto)/.test(folded)
      ) {
        section = "outro";
      } else if (items.length > 0) {
        const last = items[items.length - 1];
        if (last) last.text = `${last.text} ${row}`;
      }
      continue;
    }
    items.push({ code, text: row.slice(row.indexOf(code) + 7), section });
  }
  const found: Partial<Record<ActItemKind, ActItem[]>> = {};
  for (const item of items) {
    const description = item.text
      .replace(MONEY, "")
      .replace(/\s+/g, " ")
      .replace(/^[\s\-:.|]+|[\s\-:.|]+$/g, "")
      .trim()
      .slice(0, 200);
    const kind = actItemKind(description);
    if (!kind) continue;
    const amounts = item.text.match(MONEY) ?? [];
    const list = found[kind] ?? [];
    list.push({
      code: item.code,
      description,
      totalCents: amounts.length ? cents(amounts[amounts.length - 1] ?? "") : 0,
      section: item.section,
    });
    found[kind] = list;
  }
  const rank = (s: ActItem["section"]) =>
    s === "RI" ? 0 : s === null ? 1 : s === "RTD" ? 2 : 3;
  for (const kind of Object.keys(found) as ActItemKind[]) {
    found[kind] = (found[kind] ?? [])
      .sort((a, b) => rank(a.section) - rank(b.section))
      .slice(0, 3);
  }
  return found;
}
