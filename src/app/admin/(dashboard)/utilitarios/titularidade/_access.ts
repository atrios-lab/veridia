import "server-only";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { getSession } from "@/lib/session.ts";

/** The screens answer 404 without the permission. */
export async function requireTitularidade() {
  const session = await getSession();
  if (
    !session ||
    !can(
      session.user.role ?? "",
      "titularidade.manage",
      session.user.permissions,
    )
  ) {
    notFound();
  }
  return session;
}

/**
 * The Carga da DOI's screens (decision of 15/11/2026): its own permission;
 * the acts are the same as the titularidade's, edited from either side.
 */
export async function requireDoi() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "doi.manage", session.user.permissions)
  ) {
    notFound();
  }
  return session;
}

/** The Carga CTP's screens, inside the CENSEC's (decision of 15/11/2026). */
export async function requireCtp() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "censec.manage", session.user.permissions)
  ) {
    notFound();
  }
  return session;
}
