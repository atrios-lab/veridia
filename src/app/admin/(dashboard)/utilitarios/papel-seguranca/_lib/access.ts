import "server-only";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { getSession } from "@/lib/session.ts";

/** The screens of the papel de segurança answer 404 without the permission. */
export async function requirePaperAccess() {
  const session = await getSession();
  if (
    !session ||
    !can(
      session.user.role ?? "",
      "security-paper.manage",
      session.user.permissions,
    )
  ) {
    notFound();
  }
  return session;
}
