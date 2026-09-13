// Pure config the office layer shares: no Next, no database, no `server-only`.
// Split out of tenant.ts so that lib modules needing only these (e.g.
// service-request.ts, appointments.ts, chat.ts, publications.ts) can import
// them without pulling in `next/headers`/`next/navigation`/`react`'s cache
// transitively: those only resolve inside the Next runtime, never under
// plain `node --test`. tenant.ts re-exports everything here, so the many
// callers that already import it from "@/lib/tenant.ts" see no change.
import {
  type IsoDate,
  toIsoDate,
  toZonedDateTimeInput,
} from "@/core/scheduling/calendar.ts";
import type { AgendaNow } from "@/core/scheduling/slots.ts";

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
export const OFFICE_DEADLINE_KEY = "office-deadline";
// Not part of Tenant/applyTenantOverrides: whether the office's chat is on,
// and which days and times it receives by appointment, are operational state,
// not branding or editorial content. Both are read and written directly:
// chat by src/lib/chat.ts, the agenda by src/lib/appointments.ts, never
// merged into the config-as-code shape the other keys layer onto.
export const OFFICE_CHAT_KEY = "office-chat";
export const OFFICE_AGENDA_KEY = "office-agenda";
