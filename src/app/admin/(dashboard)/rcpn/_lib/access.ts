import "server-only";
import { notFound } from "next/navigation";
import { can, type Permission } from "@/core/auth/roles.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

/**
 * The Registro Civil screens answer 404 without their permission, or when
 * the office does not offer the Registro Civil (decision of 14/11/2026).
 */
export async function requireRcpn(permission: Permission = "rcpn.search") {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", permission, session.user.permissions)
  ) {
    notFound();
  }
  if (!(await getTenant()).attributions.includes("RCPN")) notFound();
  return session;
}

export function canImport(
  session: Awaited<ReturnType<typeof requireRcpn>>,
): boolean {
  return can(session.user.role ?? "", "rcpn.import", session.user.permissions);
}

export function canIssue(
  session: Awaited<ReturnType<typeof requireRcpn>>,
): boolean {
  return can(
    session.user.role ?? "",
    "rcpn.certidao",
    session.user.permissions,
  );
}

export function canReadGuides(
  session: Awaited<ReturnType<typeof requireRcpn>>,
): boolean {
  return can(
    session.user.role ?? "",
    "attributions.view",
    session.user.permissions,
  );
}
