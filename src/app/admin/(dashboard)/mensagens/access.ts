import "server-only";
import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { getProfileWith } from "@/lib/messages.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

/**
 * Who may use the internal messenger, and how: shared by the server actions
 * and the two routes the live connection uses (decision of 19/11/2026).
 * Not in actions.ts, because every export there becomes a server action.
 */
export async function messengerAccess() {
  const session = await getSession();
  const role = session?.user.role ?? "";
  if (!session || !can(role, "messages.use", session.user.permissions)) {
    return null;
  }
  const tenant = await getTenant();
  const profile = await getProfileWith(db, tenant.slug, session.user.id);
  return {
    session,
    tenant,
    /** The holder turned this person's messenger off. */
    off: Boolean(profile?.chatDisabled),
    /** Inside the lunch window, not back yet: the chat is locked. */
    lunch: Boolean(profile?.atLunch),
    // The Átrios account reads every conversation and is seen by no one:
    // it never writes, never shows online (decision of 11/11/2026).
    platform: role === "superadmin",
    oversight:
      role === "superadmin" ||
      can(role, "audit.manage", session.user.permissions),
  };
}
