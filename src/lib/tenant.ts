import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { applyTenantOverrides } from "@/core/tenant/overrides.ts";
import {
  isPlatformHost,
  isRegisteredHost,
  resolveTenant,
} from "@/core/tenant/resolve.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { db } from "@/db/index.ts";
import { tenantContent } from "@/db/schema.ts";
import {
  OFFICE_BRAND_KEY,
  OFFICE_CONTACT_KEY,
  OFFICE_DEADLINE_KEY,
  OFFICE_DPO_KEY,
  OFFICE_PIX_KEY,
} from "./office-config.ts";
import { requestHost } from "./request-host.ts";

// Pure config (time zone, wall-clock helpers, the tenant_content keys) lives
// in office-config.ts, which has no Next import and is safe to load under
// plain `node --test`. Re-exported here so the many callers that already
// import them from "@/lib/tenant.ts" see no change.
export * from "./office-config.ts";

/**
 * Reads the office's own edits, both keys in one query: `getTenant` is
 * called by nearly every route, so a second query per key would double the
 * database load this function already adds.
 *
 * Written straight to `published`: a phone number and a logotype are both
 * operational, not editorial, and the office that corrects one needs the
 * correction live now, not after someone remembers to publish.
 *
 * A database that is down returns no overrides rather than an error. The
 * site then serves the configured values, which is a stale telephone number
 * instead of a stale telephone number and no site.
 */
async function readTenantOverrides(tenantSlug: string): Promise<{
  contact: unknown;
  brand: unknown;
  dpo: unknown;
  pix: unknown;
  deadline: unknown;
}> {
  try {
    const rows = await db
      .select({ key: tenantContent.key, published: tenantContent.published })
      .from(tenantContent)
      .where(
        and(
          eq(tenantContent.tenantSlug, tenantSlug),
          inArray(tenantContent.key, [
            OFFICE_CONTACT_KEY,
            OFFICE_BRAND_KEY,
            OFFICE_DPO_KEY,
            OFFICE_PIX_KEY,
            OFFICE_DEADLINE_KEY,
          ]),
        ),
      );
    return {
      contact:
        rows.find((r) => r.key === OFFICE_CONTACT_KEY)?.published ?? null,
      brand: rows.find((r) => r.key === OFFICE_BRAND_KEY)?.published ?? null,
      dpo: rows.find((r) => r.key === OFFICE_DPO_KEY)?.published ?? null,
      pix: rows.find((r) => r.key === OFFICE_PIX_KEY)?.published ?? null,
      deadline:
        rows.find((r) => r.key === OFFICE_DEADLINE_KEY)?.published ?? null,
    };
  } catch {
    return {
      contact: null,
      brand: null,
      dpo: null,
      pix: null,
      deadline: null,
    };
  }
}

/**
 * Resolves the office for the current request, with its own edits laid over
 * the configuration. Server only: the host header is the only input, so a
 * client component could never get this right.
 *
 * Cached per request because the layout, the page and the action all ask for
 * the office in the same render, and without this that is one query each.
 *
 * There is deliberately no second function that skips the override. Two
 * near-identical getters is how one screen ends up showing last month's
 * telephone number. `resolveTenant` stays pure and I/O free for the
 * middleware, which runs on the edge and cannot reach the database.
 */
export const getTenant = cache(async (): Promise<Tenant> => {
  const headerList = await headers();
  const host = requestHost(headerList);
  // A host that is neither an office's nor the platform's own gets a 404,
  // never the default office's site: serving one office's brand and data on
  // another's (or an unknown) host is the cross-tenant leak this exists to
  // stop.
  if (!isRegisteredHost(host) && !isPlatformHost(host)) notFound();
  const tenant = resolveTenant(
    host,
    process.env.DEFAULT_TENANT ?? "cartorio-marinho",
  );
  const overrides = await readTenantOverrides(tenant.slug);
  return applyTenantOverrides(tenant, overrides);
});
