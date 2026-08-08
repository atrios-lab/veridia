/**
 * The amount an operator informs on a service request. Never a price the
 * citizen sets: it is what the office, working the request, finds in the
 * fee table.
 */
const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatCents(cents: number): string {
  return BRL.format(cents / 100);
}

/**
 * Reads what a person typed — "62,10", "62.10", "6210" — as cents. Refuses
 * anything that is not a positive amount, so a blank or a stray letter never
 * silently becomes zero.
 */
export function parseCentsInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  // A comma is the decimal mark here; a dot is only ever a thousands
  // separator in Brazilian input, so it is dropped rather than treated as one.
  const normalized = trimmed.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return undefined;
  const cents = Math.round(Number(normalized) * 100);
  return cents > 0 ? cents : undefined;
}
