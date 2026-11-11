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
import { OFFICE_TIME_ZONE } from "@/core/time/office-time.ts";

export { OFFICE_TIME_ZONE };

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
 * Officer's contact (`office-dpo`), the office's Pix key (`office-pix`), and
 * whether its bulletin publishes the private figures (`office-bulletin`).
 */
export const OFFICE_CONTACT_KEY = "office-contact";
export const OFFICE_BRAND_KEY = "office-brand";
export const OFFICE_DPO_KEY = "office-dpo";
export const OFFICE_PIX_KEY = "office-pix";
export const OFFICE_DEADLINE_KEY = "office-deadline";
export const OFFICE_BULLETIN_KEY = "office-bulletin";
export const OFFICE_HOLIDAYS_KEY = "office-holidays";
export const OFFICE_IDENTIFICATION_KEY = "office-identification";
export const OFFICE_GUIDES_KEY = "office-tax-guides";
/** Declaração de ISS: rate, law, the office's CNPJ, the law attached. */
export const OFFICE_ISS_KEY = "office-iss";
/** ISS declared for a month whose bulletin is not published yet. */
export const OFFICE_ISS_BULLETIN_KEY = "office-iss-bulletin";
export const OFFICE_ALERTS_KEY = "office-alerts";
/** Per user: where the access code goes, and saved computers (lib/access-settings.ts). */
export const OFFICE_ACCESS_KEY = "office-access-codes";
/** Set by the Átrios master account only: two-step access on or off (lib/access-policy.ts). */
export const PLATFORM_ACCESS_POLICY_KEY = "platform-access-policy";
/** What each position may do, set by the Tabelião/Registrador (lib/role-permissions.ts). */
export const OFFICE_ROLE_PERMISSIONS_KEY = "office-role-permissions";
/** Where each numbered document goes on, per year (Configurações › Numeração). */
export const OFFICE_NUMBERING_KEY = "office-numbering";
// Not part of Tenant/applyTenantOverrides: whether the office's chat is on,
// and which days and times it receives by appointment, are operational state,
// not branding or editorial content. Both are read and written directly:
// chat by src/lib/chat.ts, the agenda by src/lib/appointments.ts, never
// merged into the config-as-code shape the other keys layer onto.
export const OFFICE_CHAT_KEY = "office-chat";
export const OFFICE_AGENDA_KEY = "office-agenda";
/** When the panel opens, and who the holder released outside it. */
export const OFFICE_ACCESS_HOURS_KEY = "office-access-hours";
/**
 * Papel de segurança (decision of 11/11/2026): to whom the ofícios go and
 * the State's rule; and, apart, which reminders already went by e-mail.
 */
export const OFFICE_SECURITY_PAPER_KEY = "office-security-paper";
export const SECURITY_PAPER_REMINDERS_KEY = "security-paper-reminders";
/** Solicitação de papéis de segurança: the office as the orders present it. */
export const OFFICE_PAPER_ORDERS_KEY = "office-paper-orders";
/** Livro Diário Auxiliar: the specialties by act code, who answers for it. */
export const OFFICE_DAILY_BOOK_KEY = "office-daily-book";
/**
 * Livro Diário Auxiliar › boletim mensal: the month's figures prepared from
 * the productivity reports, waiting on the bulletin's form to be checked
 * and published.
 */
export const OFFICE_BOOK_BULLETIN_KEY = "office-book-bulletin";
