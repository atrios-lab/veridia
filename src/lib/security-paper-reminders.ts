import "server-only";
import { sql } from "drizzle-orm";
import { buildSecurityPaperReminderEmail } from "@/core/security-paper/reminders.ts";
import { monthLabel, usageMissing } from "@/core/security-paper/stock.ts";
import { brandImageUrl } from "@/core/tenant/brand-image.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { type Database, db } from "@/db/index.ts";
import { tenantContent } from "@/db/schema.ts";
import { renderEmailCardHtml, renderEmailCardText } from "./email/render.ts";
import { sendEmail } from "./email/send.ts";
import { SECURITY_PAPER_REMINDERS_KEY } from "./office-config.ts";
import {
  classifierWith,
  getSecurityPaperSettingsWith,
  lowStockWith,
  pendingDutiesWith,
} from "./security-paper.ts";

/**
 * Claims one reminder (`field`: "quarter" or "month") for `tag`: true once
 * per tag and office, false to everyone after, in one statement, so the
 * daily job and a panel opened at the same minute never send it twice.
 */
export async function claimSecurityPaperReminderWith(
  database: Database,
  tenantSlug: string,
  field: "quarter" | "month" | "low" | "usage",
  tag: string,
): Promise<boolean> {
  const value = { [field]: tag };
  const rows = await database
    .insert(tenantContent)
    .values({ tenantSlug, key: SECURITY_PAPER_REMINDERS_KEY, published: value })
    .onConflictDoUpdate({
      target: [tenantContent.tenantSlug, tenantContent.key],
      set: {
        published: sql`coalesce(${tenantContent.published}, '{}'::jsonb) || ${JSON.stringify(value)}::jsonb`,
        updatedAt: new Date(),
      },
      setWhere: sql`(${tenantContent.published}->>${field}) is distinct from ${tag}`,
    })
    .returning({ key: tenantContent.key });
  return rows.length > 0;
}

/**
 * Sends the office the papel de segurança's reminder when something is
 * owed: once per quarter for the accounts, once per month for losses not
 * told. Best effort, like every e-mail here.
 */
export async function sendSecurityPaperReminders(
  tenant: Tenant,
  today: string,
  database: Database = db,
): Promise<boolean> {
  if (!tenant.contacts.email) return false;
  const duties = await pendingDutiesWith(database, tenant.slug, today);
  const quarter =
    duties.quarter &&
    (await claimSecurityPaperReminderWith(
      database,
      tenant.slug,
      "quarter",
      `${duties.quarter.year}-T${duties.quarter.quarter}`,
    ))
      ? duties.quarter
      : null;
  const month =
    duties.occurrences.length > 0 &&
    (await claimSecurityPaperReminderWith(
      database,
      tenant.slug,
      "month",
      today.slice(0, 7),
    ));
  const settings = await getSecurityPaperSettingsWith(database, tenant);
  const lowKinds = await lowStockWith(database, tenant);
  // Once a month while the stock stays low, and again if another kind joins.
  const low =
    lowKinds.length > 0 &&
    (await claimSecurityPaperReminderWith(
      database,
      tenant.slug,
      "low",
      `${today.slice(0, 7)}:${lowKinds.map((l) => l.paperKind).join(",")}`,
    ));
  const { lots, movements } = await classifierWith(database, tenant.slug);
  const missing = usageMissing({ today, lots, movements });
  const usage =
    missing !== null &&
    (await claimSecurityPaperReminderWith(
      database,
      tenant.slug,
      "usage",
      missing.start.slice(0, 7),
    ));
  if (!quarter && !month && !low && !usage) return false;
  const text = buildSecurityPaperReminderEmail({
    officeName: tenant.name,
    quarter,
    occurrences: month ? duties.occurrences : [],
    deadlineDay: settings.deadlineDay,
    low: low ? lowKinds : [],
    usageMonth: usage && missing ? monthLabel(missing.start) : undefined,
  });
  const host = tenant.hosts[0];
  const url = `${host ? `https://${host}` : ""}/admin/utilitarios/papel-seguranca`;
  try {
    await sendEmail({
      to: tenant.contacts.email,
      fromName: tenant.name,
      fromAddress: tenant.emailFrom,
      subject: text.subject,
      html: renderEmailCardHtml(
        text,
        {
          name: tenant.name,
          subtitle: tenant.subtitle,
          sealUrl: brandImageUrl(tenant.logos.seal.light, host),
        },
        url,
      ),
      text: renderEmailCardText(text, url),
    });
  } catch (error) {
    console.error("security-paper.reminder", tenant.slug, error);
  }
  return true;
}

const lastRun = new Map<string, number>();

/** The backup run as the panel opens: at most every ten minutes. */
export async function sendSecurityPaperRemindersInBackground(
  tenant: Tenant,
  today: string,
): Promise<void> {
  const last = lastRun.get(tenant.slug) ?? 0;
  if (Date.now() - last < 10 * 60 * 1000) return;
  lastRun.set(tenant.slug, Date.now());
  try {
    await sendSecurityPaperReminders(tenant, today);
  } catch (error) {
    console.error("security-paper.reminder.backup", tenant.slug, error);
  }
}
