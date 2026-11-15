import { writtenDate } from "../scheduling/attendance.ts";
import type { Tenant } from "../tenant/schema.ts";
import { MASK_MARKERS } from "./mask.ts";

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
  "CIDADE",
  "DATA",
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

/**
 * The office's own markers, filled by the platform in every text the
 * Assistente Virtual writes (decision of 15/11/2026: the text comes out
 * ready, nothing left to complete): the office, its encarregado, the city
 * and the day.
 */
export function officePlaceholders(
  tenant: Pick<Tenant, "subtitle" | "dpo" | "location">,
  isoDay: string,
): PlaceholderValues {
  return {
    SERVENTIA: tenant.subtitle,
    ENCARREGADO: tenant.dpo.name,
    CIDADE: `${tenant.location.city}/${tenant.location.state}`,
    DATA: writtenDate(isoDay as Parameters<typeof writtenDate>[0]),
  };
}

/**
 * A gap left for someone to fill: "[COMPLETAR: ...]", "[INSERIR ...]", a
 * bracket the platform does not fill, or "____". The text must come out
 * ready (decision of 15/11/2026).
 */
const MASKED = new Set<string>(Object.values(MASK_MARKERS));

export function hasGaps(text: string): boolean {
  if (/_{4,}|\(\s*\.\.\.\s*\)|\[\s*\.\.\.\s*\]/.test(text)) return true;
  for (const match of text.matchAll(/\[([^\]\n]{1,80})\]/g)) {
    const inside = match[1] ?? "";
    if ((PLACEHOLDERS as readonly string[]).includes(inside)) continue;
    // Source markers and the masking's markers are not gaps.
    if (/^\[fonte:/.test(match[0]) || inside.startsWith("[fonte:")) continue;
    if (MASKED.has(`[${inside}]`)) continue;
    return true;
  }
  return false;
}
