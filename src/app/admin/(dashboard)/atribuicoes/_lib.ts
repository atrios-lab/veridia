import "server-only";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { getSession } from "@/lib/session.ts";
import type { AdminIconName } from "../../_components/icon.tsx";

/** The guides answer 404 without their permission. */
export async function requireGuides() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "attributions.view", session.user.permissions)
  ) {
    notFound();
  }
  return session;
}

export const GUIDE_ICONS: Record<string, AdminIconName> = {
  "registro-civil": "file",
  "registro-de-imoveis": "house",
  "titulos-e-documentos": "files",
  "pessoas-juridicas": "building",
  protesto: "gavel",
  distribuicao: "shuffle",
  notas: "signature",
  caixa: "wallet",
};
