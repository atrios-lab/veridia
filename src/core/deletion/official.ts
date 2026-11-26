/**
 * Which deletions are of an official document and so wait for the
 * Tabelião (decision of 26/11/2026). The holder ("admin") approves; when
 * the holder deletes, the act is immediate, with the reason.
 */

export const OFFICIAL_KINDS = {
  "ri-property": "Matrícula ou registro do Livro 3",
  "ri-act": "Ato (registro ou averbação)",
  "ri-protocol": "Protocolo (prenotação)",
  "ri-book": "Livro",
  "ri-onr-image": "Imagem da matrícula para a ONR",
} as const;

export type OfficialKind = keyof typeof OFFICIAL_KINDS;

/** Whoever holds the office decides: the Tabelião/Registrador. */
export function decidesDeletions(role: string): boolean {
  return role === "admin" || role === "superadmin";
}
