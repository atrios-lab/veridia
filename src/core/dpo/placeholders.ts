/**
 * The markers the DPO assistant writes where a person's or the office's data
 * goes. The model never receives that data (decision of 15/11/2026: only
 * generic questions leave the platform); the platform fills the markers in,
 * on its own server, when the draft lands in a requerimento's reply.
 */
export const PLACEHOLDERS = [
  "TITULAR",
  "PROTOCOLO",
  "DATA_DO_PEDIDO",
  "SERVENTIA",
  "ENCARREGADO",
] as const;
export type Placeholder = (typeof PLACEHOLDERS)[number];

export type PlaceholderValues = Partial<Record<Placeholder, string | null>>;

/**
 * Swaps each `[MARKER]` that has a value. A marker without one stays in the
 * text, visible, for the person to complete: an empty gap in a letter to a
 * citizen is worse than a bracket nobody can miss.
 */
export function fillPlaceholders(
  draft: string,
  values: PlaceholderValues,
): string {
  return draft.replace(/\[([A-Z_]+)\]/g, (marker, name: string) => {
    const value = values[name as Placeholder];
    return value?.trim() ? value.trim() : marker;
  });
}
