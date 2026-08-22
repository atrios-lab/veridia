import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import {
  type IsoDate,
  toIsoDate,
  toZonedDateTimeInput,
} from "@/core/scheduling/calendar.ts";
import type { AgendaNow } from "@/core/scheduling/slots.ts";
import { applyTenantOverrides } from "@/core/tenant/overrides.ts";
import {
  isPlatformHost,
  isRegisteredHost,
  resolveTenant,
} from "@/core/tenant/resolve.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { db } from "@/db/index.ts";
import { tenantContent } from "@/db/schema.ts";

/**
 * The office's time zone. The offices served are all in Brazil, and the
 * server runs in UTC: without this, from nine at night the site would offer
 * tomorrow as if it were today.
 */
export const OFFICE_TIME_ZONE = "America/Sao_Paulo";

/** Today on the office's wall calendar. */
export function today(): IsoDate {
  return toIsoDate(new Date(), OFFICE_TIME_ZONE);
}

/**
 * The office's wall clock right now, day and "HH:mm", for the agenda's cutoff
 * on today's times. The core never reads a clock; this is where the clock is
 * read and handed to it.
 */
export function officeNow(): AgendaNow {
  const stamp = toZonedDateTimeInput(new Date(), OFFICE_TIME_ZONE);
  return { date: stamp.slice(0, 10), time: stamp.slice(11, 16) };
}

/**
 * The `tenant_content` rows holding what the office edits about itself in the
 * panel: counter hours and the three contact channels (`office-contact`),
 * theme, logos, hero and sections (`office-brand`), the Data Protection
 * Officer's contact (`office-dpo`), and the office's Pix key (`office-pix`).
 */
export const OFFICE_CONTACT_KEY = "office-contact";
export const OFFICE_BRAND_KEY = "office-brand";
export const OFFICE_DPO_KEY = "office-dpo";
export const OFFICE_PIX_KEY = "office-pix";
// Not part of Tenant/applyTenantOverrides: whether the office's chat is on,
// and which days and times it receives by appointment, are operational state,
// not branding or editorial content. Both are read and written directly:
// chat by src/lib/chat.ts, the agenda by src/lib/appointments.ts, never
// merged into the config-as-code shape the other four keys layer onto.
export const OFFICE_CHAT_KEY = "office-chat";
export const OFFICE_AGENDA_KEY = "office-agenda";

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
          ]),
        ),
      );
    return {
      contact:
        rows.find((r) => r.key === OFFICE_CONTACT_KEY)?.published ?? null,
      brand: rows.find((r) => r.key === OFFICE_BRAND_KEY)?.published ?? null,
      dpo: rows.find((r) => r.key === OFFICE_DPO_KEY)?.published ?? null,
      pix: rows.find((r) => r.key === OFFICE_PIX_KEY)?.published ?? null,
    };
  } catch {
    return { contact: null, brand: null, dpo: null, pix: null };
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
  const host = headerList.get("host") ?? undefined;
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
