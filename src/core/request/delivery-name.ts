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
    "Guia de transmissão de bens",
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

/**
 * The name typed for a batch of files, one per file: the first as typed,
 * then "(2)", "(3)". Empty when nothing usable was typed.
 */
export function numberedNames(typed: string, count: number): string[] {
  const name = sanitizeDeliveryName(typed);
  if (!name) return [];
  return Array.from({ length: count }, (_, index) =>
    index === 0 ? name : sanitizeDeliveryName(`${name} (${index + 1})`),
  );
}

/**
 * The names for a batch: one typed per file (the request form names each
 * file it lists), or a single one for all, numbered. A file left blank gets
 * no name here and keeps the default.
 */
export function namesForFiles(
  typed: readonly string[],
  count: number,
): (string | undefined)[] {
  if (typed.length > 1 && typed.length === count) {
    return typed.map((name) => sanitizeDeliveryName(name) || undefined);
  }
  const numbered = numberedNames(typed[0] ?? "", count);
  return Array.from({ length: count }, (_, index) => numbered[index]);
}

/** What a citizen usually sends, offered under the name field. */
export const CITIZEN_DOCUMENT_NAMES = [
  "Documento de identidade (RG ou CNH)",
  "CPF",
  "Comprovante de residência",
  "Certidão de nascimento",
  "Certidão de casamento",
  "Certidão de óbito",
  "Procuração",
  "Matrícula do imóvel",
  "Contrato",
  "Comprovante de pagamento",
  "Declaração",
  "Resposta à exigência",
] as const;

/** What the office attaches, offered under the name field in the panel. */
export const OFFICE_DOCUMENT_NAMES = [
  "Certidão",
  "Traslado",
  "Escritura",
  "Guia de transmissão de bens",
  "Boleto",
  "Recibo de emolumentos",
  "Nota de exigência",
  "Requerimento",
  "Ofício",
  "Documento de identidade",
  "Comprovante",
  "Relatório",
] as const;
