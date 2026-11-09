import "server-only";
import { and, eq } from "drizzle-orm";
import { type OfficeAlerts, parseOfficeAlerts } from "@/core/alerts/office.ts";
import { type Database, db } from "@/db/index.ts";
import { tenantContent } from "@/db/schema.ts";
import { OFFICE_ALERTS_KEY } from "@/lib/office-config.ts";
import { recordAuditWith } from "./audit.ts";

/** The office's alert choices; the defaults until it saves, or if unreadable. */
export async function getOfficeAlerts(
  tenantSlug: string,
): Promise<OfficeAlerts> {
  try {
    const [row] = await db
      .select({ published: tenantContent.published })
      .from(tenantContent)
      .where(
        and(
          eq(tenantContent.tenantSlug, tenantSlug),
          eq(tenantContent.key, OFFICE_ALERTS_KEY),
        ),
      )
      .limit(1);
    return parseOfficeAlerts(row?.published);
  } catch {
    return parseOfficeAlerts(null);
  }
}

export async function saveOfficeAlertsWith(
  database: Database,
  tenantSlug: string,
  alerts: OfficeAlerts,
  actorId: string,
): Promise<void> {
  await database
    .insert(tenantContent)
    .values({
      tenantSlug,
      key: OFFICE_ALERTS_KEY,
      published: alerts,
      publishedAt: new Date(),
      updatedBy: actorId,
    })
    .onConflictDoUpdate({
      target: [tenantContent.tenantSlug, tenantContent.key],
      set: {
        published: alerts,
        publishedAt: new Date(),
        updatedAt: new Date(),
        updatedBy: actorId,
      },
    });
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "office-settings.save",
    targetType: "tenant-content",
    targetId: OFFICE_ALERTS_KEY,
  });
}
