import "server-only";
import { and, eq, sql } from "drizzle-orm";
import {
  type Ciencia,
  cienciaByKey,
  type ViewAction,
  type ViewMark,
  type ViewTarget,
} from "@/core/request/citizen-view.ts";
import type { Database } from "@/db/index.ts";
import { serviceRequestCitizenViews } from "@/db/schema.ts";

/** Who opened it, kept only on the first time, as evidence. */
export interface ViewerTrace {
  ip?: string;
  userAgent?: string;
}

/**
 * Records the citizen's ciência: the first moment of each mark stays as it
 * was (it is what certifies the delivery); a later visit moves only the last
 * moment and the count.
 */
export async function recordCitizenViewsWith(
  database: Database,
  tenantSlug: string,
  requestId: string,
  marks: readonly ViewMark[],
  trace: ViewerTrace = {},
  now = new Date(),
): Promise<void> {
  if (!marks.length) return;
  await database
    .insert(serviceRequestCitizenViews)
    .values(
      marks.map((mark) => ({
        tenantSlug,
        requestId,
        target: mark.target,
        targetId: mark.targetId,
        action: mark.action,
        firstAt: now,
        lastAt: now,
        times: 1,
        firstIp: trace.ip?.slice(0, 64) || null,
        firstUserAgent: trace.userAgent?.slice(0, 300) || null,
      })),
    )
    .onConflictDoUpdate({
      target: [
        serviceRequestCitizenViews.requestId,
        serviceRequestCitizenViews.target,
        serviceRequestCitizenViews.targetId,
        serviceRequestCitizenViews.action,
      ],
      set: {
        lastAt: now,
        times: sql`${serviceRequestCitizenViews.times} + 1`,
      },
    });
}

export interface CitizenViewRecord {
  target: ViewTarget;
  targetId: string;
  action: ViewAction;
  firstAt: Date;
  lastAt: Date;
  times: number;
  firstIp: string | null;
  firstUserAgent: string | null;
}

/** Every mark of a request, oldest first. */
export async function listCitizenViewsWith(
  database: Database,
  tenantSlug: string,
  requestId: string,
): Promise<CitizenViewRecord[]> {
  const rows = await database
    .select()
    .from(serviceRequestCitizenViews)
    .where(
      and(
        eq(serviceRequestCitizenViews.tenantSlug, tenantSlug),
        eq(serviceRequestCitizenViews.requestId, requestId),
      ),
    )
    .orderBy(serviceRequestCitizenViews.firstAt);
  return rows.map((row) => ({
    target: row.target as ViewTarget,
    targetId: row.targetId,
    action: row.action as ViewAction,
    firstAt: row.firstAt,
    lastAt: row.lastAt,
    times: row.times,
    firstIp: row.firstIp,
    firstUserAgent: row.firstUserAgent,
  }));
}

/** The request's ciência, by thing (see `viewKey`). */
export async function citizenCienciaWith(
  database: Database,
  tenantSlug: string,
  requestId: string,
): Promise<Map<string, Ciencia>> {
  return cienciaByKey(
    await listCitizenViewsWith(database, tenantSlug, requestId),
  );
}
