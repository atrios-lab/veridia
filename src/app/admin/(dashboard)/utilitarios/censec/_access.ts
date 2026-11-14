import "server-only";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { getSession } from "@/lib/session.ts";

/** The screens answer 404 without the permission. */
export async function requireCensec() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "censec.manage", session.user.permissions)
  ) {
    notFound();
  }
  return session;
}

/** Whether the request may download the CENSEC's files. */
export async function mayDownloadCensec(): Promise<boolean> {
  const session = await getSession();
  return Boolean(
    session &&
      can(session.user.role ?? "", "censec.manage", session.user.permissions),
  );
}
