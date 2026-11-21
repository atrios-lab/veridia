import "server-only";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { getSession } from "@/lib/session.ts";

/** The screens answer 404 without the permission (everyone at the desk). */
export async function requireCedulas() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "cedulas.manage", session.user.permissions)
  ) {
    notFound();
  }
  return session;
}
