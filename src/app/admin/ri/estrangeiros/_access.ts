import "server-only";
import { can } from "@/core/auth/roles.ts";
import { getSession } from "@/lib/session.ts";

/** Whoever reads the acervo of the RI reads this book. */
export async function canReadForeign(): Promise<boolean> {
  const session = await getSession();
  return Boolean(
    session &&
      can(session.user.role ?? "", "ri.view", session.user.permissions),
  );
}
