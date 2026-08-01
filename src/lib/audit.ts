import "server-only";
import { db } from "../db/index.ts";
import { auditLog } from "../db/schema.ts";

export interface AuditEntry {
  tenantSlug: string;
  /** Who did it. Null only when the actor is not authenticated yet. */
  actorId: string | null;
  /** What happened, as a stable verb: "session.sign-in", "content.publish". */
  action: string;
  targetType: string;
  targetId?: string | null;
}

/**
 * Records actor, action, target and date. Nothing else goes in: no password,
 * no token, no document body. A trail that carries payloads is a second copy
 * of the data to leak, and it is the copy nobody remembers to protect.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    tenantSlug: entry.tenantSlug,
    actorId: entry.actorId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? null,
  });
}
