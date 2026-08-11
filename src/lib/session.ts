import "server-only";
import { headers } from "next/headers";
import { canAccessTenant } from "@/core/auth/roles.ts";
import { auth } from "./auth.ts";
import { getTenant } from "./tenant.ts";

/**
 * Authoritative session check, and the single place the office is enforced.
 *
 * It hits the database, so a session revoked there is gone on the very next
 * request. It also refuses a session whose user belongs to another office,
 * which is what makes a cookie issued on the wrong domain inert: the sign in
 * form is not the only way to get one, the auth route can mint one too, and
 * guarding only the form would leave every future route to remember the
 * check on its own.
 */
export async function getSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const tenant = await getTenant();
  if (
    !canAccessTenant(
      session.user.role ?? "",
      session.user.tenantSlug ?? "",
      tenant.slug,
    )
  )
    return null;

  return session;
}
