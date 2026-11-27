import { can } from "../auth/roles.ts";

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

/**
 * Who decides: the Tabelião/Registrador, and whoever he authorized in
 * Perfis e permissões (the substitute, decision of 27/11/2026).
 */
export function decidesDeletions(
  role: string,
  granted?: readonly string[],
): boolean {
  if (role === "superadmin") return true;
  return can(role, "deletion.decide", granted);
}
