import { notFound } from "next/navigation";
import { isSectionEnabled } from "@/core/tenant/gating.ts";
import type { Section, Tenant } from "@/core/tenant/schema.ts";
import { getTenant } from "@/lib/tenant.ts";

/**
 * Resolves the office and refuses the route when the section is off for it.
 * Leaving the link out of the menu is presentation; this is the control, and
 * every public page under a gated section has to call it.
 */
export async function requireSection(section: Section): Promise<Tenant> {
  const tenant = await getTenant();
  if (!isSectionEnabled(tenant, section)) notFound();
  return tenant;
}
