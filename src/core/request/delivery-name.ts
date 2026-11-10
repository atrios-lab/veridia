/**
 * The name a delivered document carries, for the clerk and for the citizen
 * who downloads it (decision of 10/11/2026). Before, every delivery read
 * "documento-final", once per file, which told the citizen nothing. Now the
 * clerk may type one, pick a suggestion built from the protocol and the
 * act, or leave it blank for a numbered default with the protocol.
 */

/** The old slug every delivery used to carry. */
export const LEGACY_DELIVERY_NAME = "documento-final";

const MAX = 100;

/** Trimmed, one line, no characters a file name cannot carry. */
export function sanitizeDeliveryName(text: string): string {
  return (
    [...text]
      // Control characters (a pasted line break, a tab) become spaces.
      .map((char) => ((char.codePointAt(0) ?? 0) < 32 ? " " : char))
      .join("")
      // A slash would cut the file name: "ITIV/ITBI" reads "ITIV-ITBI".
      .replace(/\s*[\\/]\s*/g, "-")
      .replace(/[:*?"<>|]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX)
      .trim()
  );
}

/** "Documento final · REQ.2026.000123", then "Documento final 2 · ...". */
export function defaultDeliveryName(
  protocolNumber: string,
  alreadyDelivered: number,
): string {
  const number = alreadyDelivered > 0 ? ` ${alreadyDelivered + 1}` : "";
  return `Documento final${number} · ${protocolNumber}`;
}

/** What the clerk typed, or the numbered default. */
export function deliveryName(
  typed: string,
  protocolNumber: string,
  alreadyDelivered: number,
): string {
  return (
    sanitizeDeliveryName(typed) ||
    defaultDeliveryName(protocolNumber, alreadyDelivered)
  );
}

/** Names offered under the field, from the act and the protocol. */
export function deliveryNameSuggestions(
  protocolNumber: string,
  actName: string | undefined,
): string[] {
  const kinds = [
    ...(actName ? [actName] : []),
    "Certidão",
    "Traslado",
    "Escritura",
    "Guia de recolhimento",
    "Boleto",
    "Recibo de emolumentos",
    "Nota de exigência",
  ];
  return [...new Set(kinds)].map((kind) =>
    sanitizeDeliveryName(`${kind} · ${protocolNumber}`),
  );
}

/** What a delivery is called on screen, old ones included. */
export function deliveryLabel(displayName: string): string {
  return displayName === LEGACY_DELIVERY_NAME ? "Documento final" : displayName;
}
