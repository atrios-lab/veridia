/**
 * Money typed in a field (decision of 24/11/2026: "onde tiver a parte de
 * digitar valores, que ele já coloque os pontos e vírgulas
 * automaticamente"). Like a card machine: the digits fill from the cents,
 * so typing 1, 2, 3, 4, 5 reads 0,01, 0,12, 1,23, 12,34, 123,45, and the
 * thousands dots come by themselves (1.234,56). What the field shows is
 * what is posted, and every reader of money in the panel takes it.
 */

/** "1.234,56" from a whole number of cents. */
export function centsToMoneyText(cents: number): string {
  const safe = Math.max(0, Math.round(cents));
  const reais = Math.floor(safe / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${reais},${String(safe % 100).padStart(2, "0")}`;
}

/**
 * The field's text after a keystroke: only the digits count, read as
 * cents. Empty stays empty, so a field left blank is still blank.
 */
export function formatMoneyTyping(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!digits) return "";
  // Beyond a trillion reais is a mistyped field, not a value.
  return centsToMoneyText(Number(digits.slice(0, 15)));
}

/**
 * A value that arrived from elsewhere (the database, a reading, a paste)
 * shown the way the field writes it: "1234.5", "1234,50", "1.234,50" and
 * "R$ 1.234,50" all read 1.234,50. Text that is not money is left as is.
 */
export function toMoneyText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return Number.isFinite(value) ? centsToMoneyText(value * 100) : "";
  }
  const text = value.replace(/R\$|\s/g, "");
  if (!text) return "";
  // Comma decimal (pt-BR), dots only grouping.
  let match = /^(\d{1,3}(?:\.\d{3})+|\d+),(\d{1,2})$/.exec(text);
  if (match?.[1] && match[2] !== undefined) {
    return centsToMoneyText(
      Number(match[1].replace(/\./g, "")) * 100 +
        Number(match[2].padEnd(2, "0")),
    );
  }
  // Grouped thousands with no decimals: "1.234" is a thousand.
  if (/^\d{1,3}(?:\.\d{3})+$/.test(text)) {
    return centsToMoneyText(Number(text.replace(/\./g, "")) * 100);
  }
  // A dot decimal, as a number prints: "1234.5".
  match = /^(\d+)\.(\d{1,2})$/.exec(text);
  if (match?.[1] && match[2] !== undefined) {
    return centsToMoneyText(
      Number(match[1]) * 100 + Number(match[2].padEnd(2, "0")),
    );
  }
  if (/^\d+$/.test(text)) return centsToMoneyText(Number(text) * 100);
  return value;
}
