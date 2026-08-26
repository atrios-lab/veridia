import "server-only";
import { eq } from "drizzle-orm";
import {
  user as userTable,
  verification as verificationTable,
} from "@/db/auth-schema.ts";
import { db } from "@/db/index.ts";
import {
  emailChangeIdentifier,
  parseEmailChangeValue,
} from "@/lib/auth-tokens.ts";

/**
 * The pending change a confirmation link stands for, or null when the link
 * expired, was already used, was replaced by a newer request, points at an
 * account that no longer exists, or belongs to another office. Every one of
 * those is the same answer to whoever opened it: this link does not work.
 *
 * Scoped to the office serving the request for the same reason `getSession`
 * is: the link was built on that office's host, and a token that resolves
 * against whatever domain it is pasted into is a cross-tenant hole waiting
 * for someone to find it.
 *
 * Read by both the page and the action, because the page has to name the
 * address before the person confirms, and the action must not trust what
 * the page saw.
 */
export async function findEmailChange(token: string, tenantSlug: string) {
  const [row] = await db
    .select({
      value: verificationTable.value,
      expiresAt: verificationTable.expiresAt,
    })
    .from(verificationTable)
    .where(eq(verificationTable.identifier, emailChangeIdentifier(token)));
  if (!row || row.expiresAt < new Date()) return null;

  const pending = parseEmailChangeValue(row.value);
  if (!pending) return null;

  const [account] = await db
    .select({
      name: userTable.name,
      email: userTable.email,
      tenantSlug: userTable.tenantSlug,
    })
    .from(userTable)
    .where(eq(userTable.id, pending.userId));
  if (!account || account.tenantSlug !== tenantSlug) return null;

  return {
    userId: pending.userId,
    email: pending.email,
    previousEmail: account.email,
    name: account.name,
  };
}
