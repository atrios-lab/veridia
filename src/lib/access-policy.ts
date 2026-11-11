import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { type Database, db } from "@/db/index.ts";
import { tenantContent } from "@/db/schema.ts";
import { PLATFORM_ACCESS_POLICY_KEY } from "@/lib/office-config.ts";
import { recordAuditWith } from "./audit.ts";

/**
 * Liberação de acesso (decision of 11/11/2026): the Átrios master account
 * turns the panel's two-step access off, or back on, for any office, from
 * its own login; the office's Tabelião/Registrador can too, from
 * Configurações › Duas etapas (an e-mail outage). On by default; stored in
 * the office's own tenant_content row.
 */
const PolicySchema = z.object({
  twoStep: z.enum(["on", "off"]),
  reason: z.string().max(300).optional(),
  changedAt: z.string().optional(),
  by: z.enum(["platform", "office"]).optional(),
});
export type AccessPolicy = z.infer<typeof PolicySchema>;

const DEFAULT: AccessPolicy = { twoStep: "on" };

function parse(raw: unknown): AccessPolicy {
  const parsed = PolicySchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT;
}

export async function getAccessPolicyWith(
  database: Database,
  tenantSlug: string,
): Promise<AccessPolicy> {
  const [row] = await database
    .select({ published: tenantContent.published })
    .from(tenantContent)
    .where(
      and(
        eq(tenantContent.tenantSlug, tenantSlug),
        eq(tenantContent.key, PLATFORM_ACCESS_POLICY_KEY),
      ),
    )
    .limit(1);
  return parse(row?.published);
}

/** Whether this office's panel asks for the e-mail code. */
export async function twoStepEnabledFor(tenantSlug: string): Promise<boolean> {
  try {
    return (await getAccessPolicyWith(db, tenantSlug)).twoStep === "on";
  } catch {
    // Unreadable: the safe answer is to keep asking.
    return true;
  }
}

/** Every office's policy at once, for the platform's screen. */
export async function listAccessPoliciesWith(
  database: Database,
  tenantSlugs: string[],
): Promise<Record<string, AccessPolicy>> {
  const rows = tenantSlugs.length
    ? await database
        .select({
          slug: tenantContent.tenantSlug,
          published: tenantContent.published,
        })
        .from(tenantContent)
        .where(
          and(
            eq(tenantContent.key, PLATFORM_ACCESS_POLICY_KEY),
            inArray(tenantContent.tenantSlug, tenantSlugs),
          ),
        )
    : [];
  const result: Record<string, AccessPolicy> = {};
  for (const slug of tenantSlugs) result[slug] = DEFAULT;
  for (const row of rows) result[row.slug] = parse(row.published);
  return result;
}

export async function setAccessPolicyWith(
  database: Database,
  tenantSlug: string,
  twoStep: "on" | "off",
  reason: string,
  actorId: string,
  now = new Date(),
  /** Who switched it: the Átrios master account, or the office itself. */
  by: "platform" | "office" = "platform",
): Promise<void> {
  const published: AccessPolicy = {
    twoStep,
    by,
    ...(reason.trim() ? { reason: reason.trim().slice(0, 300) } : {}),
    changedAt: now.toISOString(),
  };
  await database
    .insert(tenantContent)
    .values({
      tenantSlug,
      key: PLATFORM_ACCESS_POLICY_KEY,
      published,
      publishedAt: now,
      updatedBy: actorId,
    })
    .onConflictDoUpdate({
      target: [tenantContent.tenantSlug, tenantContent.key],
      set: { published, publishedAt: now, updatedAt: now, updatedBy: actorId },
    });
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: `${by}.two-step-${twoStep}`,
    targetType: "tenant",
    targetId: tenantSlug,
  });
}
