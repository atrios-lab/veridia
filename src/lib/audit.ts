import "server-only";
import { type AnyColumn, type SQL, sql } from "drizzle-orm";
import { type Database, db } from "../db/index.ts";
import { auditLog } from "../db/schema.ts";
import { currentJustification } from "./audit-reason.ts";

export interface AuditEntry {
  tenantSlug: string;
  /** Who did it. Null only when the actor is not authenticated yet. */
  actorId: string | null;
  /** What happened, as a stable verb: "session.sign-in", "content.publish". */
  action: string;
  targetType: string;
  targetId?: string | null;
  /** Why, when the act asked for it; the request's justification otherwise. */
  reason?: string | null;
}

/**
 * Records actor, action, target, date and, for a sensitive act, the
 * justification its author typed. Nothing else goes in: no password,
 * no token, no document body. A trail that carries payloads is a second copy
 * of the data to leak, and it is the copy nobody remembers to protect.
 */
export async function recordAuditWith(
  database: Database,
  entry: AuditEntry,
): Promise<void> {
  await database.insert(auditLog).values({
    tenantSlug: entry.tenantSlug,
    actorId: entry.actorId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? null,
    reason: entry.reason ?? currentJustification() ?? null,
  });
}

/**
 * Leaves out what the Átrios platform account did (decision of 11/11/2026):
 * it is invisible to every office, its acts, tests and changes included.
 * Only the Átrios account itself sees them. An act with no actor (the
 * system) stays.
 */
export function notByPlatform(): SQL {
  return notPlatformAccount(auditLog.actorId);
}

/**
 * The same rule for any column that holds who wrote something (a note's
 * author, who marked an act as reviewed): what the Átrios account wrote
 * leaves no trace an office can read (decision of 13/11/2026). A null
 * author stays.
 */
export function notPlatformAccount(column: AnyColumn): SQL {
  return sql`(${column} is null or ${column} not in (select "id" from "user" where "role" = 'superadmin'))`;
}

/** The production singleton, for callers that do not test against it. */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  return recordAuditWith(db, entry);
}
