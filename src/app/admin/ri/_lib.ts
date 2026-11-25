import "server-only";
import { notFound } from "next/navigation";
import { can, type Permission } from "@/core/auth/roles.ts";
import { formatOfficeDateTime } from "@/core/time/office-time.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

/**
 * The screens of the Registro de Imóveis answer 404 without their
 * permission, or when the office does not exercise the Registro de Imóveis.
 */
export async function requireRi(permission: Permission = "ri.view") {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", permission, session.user.permissions)
  ) {
    notFound();
  }
  const tenant = await getTenant();
  if (!tenant.attributions.includes("RI")) notFound();
  return { session, tenant };
}

export type RiSession = Awaited<ReturnType<typeof requireRi>>["session"];

export function riCan(session: RiSession, permission: Permission): boolean {
  return can(session.user.role ?? "", permission, session.user.permissions);
}

/** Date and time in the office's zone; empty for none. */
export function stamp(date: Date | null | undefined): string {
  return date ? formatOfficeDateTime(date) : "";
}
