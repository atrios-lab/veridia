import "server-only";
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

/** The production singleton, for callers that do not test against it. */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  return recordAuditWith(db, entry);
}
