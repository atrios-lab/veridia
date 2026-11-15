import "server-only";
import { and, eq } from "drizzle-orm";
import { classificationOf } from "@/core/compliance/classification.ts";
import { detectPendencies } from "@/core/compliance/pendencies.ts";
import { describeOffice } from "@/core/dpo/context.ts";
import { dataRightsDayOfDeadline } from "@/core/request/channels.ts";
import { toIsoDate } from "@/core/scheduling/calendar.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { OFFICE_TIME_ZONE } from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import { serviceRequests } from "@/db/schema.ts";
import { loadIntake } from "../compliance.ts";

/** Days left at which an open LGPD requerimento counts as "vencendo". */
const DUE_SOON_DAYS = 5;

/**
 * The office's situation for the assistant, in figures only
 * (core/dpo/context.ts says why there is no room for a name).
 */
export async function officeContextFor(
  tenant: Tenant,
  now: Date,
): Promise<string> {
  const today = toIsoDate(now, OFFICE_TIME_ZONE);
  const [{ answers }, openRequests] = await Promise.all([
    loadIntake(tenant),
    db
      .select({ createdAt: serviceRequests.createdAt })
      .from(serviceRequests)
      .where(
        and(
          eq(serviceRequests.tenantSlug, tenant.slug),
          eq(serviceRequests.kind, "data-rights"),
          eq(serviceRequests.status, "new"),
        ),
      ),
  ]);
  const pendencies = detectPendencies(answers);
  const bySeverity = (severity: string) =>
    pendencies.filter((p) => p.severity === severity).length;
  const dueSoon = openRequests.filter((row) => {
    const requestedOn = toIsoDate(row.createdAt, OFFICE_TIME_ZONE);
    return 15 - dataRightsDayOfDeadline(requestedOn, today) <= DUE_SOON_DAYS;
  }).length;

  return describeOffice({
    attributions: tenant.attributions,
    classification: classificationOf(answers),
    pendencies: {
      critical: bySeverity("critical"),
      warning: bySeverity("warning"),
      info: bySeverity("info"),
    },
    openDataRights: openRequests.length,
    dataRightsDueSoon: dueSoon,
    hasDpo: Boolean(tenant.dpo.name.trim()),
    today,
  });
}
