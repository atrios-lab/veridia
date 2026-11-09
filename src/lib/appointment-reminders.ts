import "server-only";
import { and, asc, desc, eq, gt, isNull, sql } from "drizzle-orm";
import {
  AGENDA_NAMES,
  agendaIdOf,
  isRemoteMode,
  slotEndTime,
} from "@/core/scheduling/agenda.ts";
import { ACTIONABLE_APPOINTMENT_STATUS } from "@/core/scheduling/appointment.ts";
import type { IsoDate } from "@/core/scheduling/calendar.ts";
import { addDays } from "@/core/scheduling/calendar.ts";
import { reminderDay } from "@/core/scheduling/reminders.ts";
import type { AgendaNow } from "@/core/scheduling/slots.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { type Database, db } from "@/db/index.ts";
import { appointments, tenantContent } from "@/db/schema.ts";
import type { Appointment } from "./appointments.ts";
import {
  sendAppointmentReminderEmail,
  sendOfficeDaySummaryEmail,
} from "./email/appointment.ts";

/** Where the office's last day summary is noted, so it goes once a day. */
export const AGENDA_REMINDERS_KEY = "agenda-reminders";

/**
 * Claims the citizens' reminders for a day: every live appointment on it
 * that has not been reminded, marked as reminded in the same statement that
 * returns it. Two runs at once (the daily job and a panel opened at the same
 * minute) split the rows between them; no row comes back twice.
 */
export async function claimDueRemindersWith(
  database: Database,
  tenantSlug: string,
  day: IsoDate,
): Promise<Appointment[]> {
  return database
    .update(appointments)
    .set({ reminderSentAt: new Date() })
    .where(
      and(
        eq(appointments.tenantSlug, tenantSlug),
        eq(appointments.date, day),
        eq(appointments.status, ACTIONABLE_APPOINTMENT_STATUS),
        isNull(appointments.reminderSentAt),
      ),
    )
    .returning();
}

/**
 * Claims the office's summary of a day: true once per day and office, false
 * to everyone after. The row is a note in `tenant_content`, upserted only
 * when it names another day.
 */
export async function claimDaySummaryWith(
  database: Database,
  tenantSlug: string,
  day: IsoDate,
): Promise<boolean> {
  const rows = await database
    .insert(tenantContent)
    .values({
      tenantSlug,
      key: AGENDA_REMINDERS_KEY,
      published: { summaryFor: day },
    })
    .onConflictDoUpdate({
      target: [tenantContent.tenantSlug, tenantContent.key],
      set: { published: { summaryFor: day }, updatedAt: new Date() },
      setWhere: sql`(${tenantContent.published}->>'summaryFor') is distinct from ${day}`,
    })
    .returning({ key: tenantContent.key });
  return rows.length > 0;
}

/** The live appointments of a day, for the office's summary. */
async function bookedOnWith(
  database: Database,
  tenantSlug: string,
  day: IsoDate,
): Promise<Appointment[]> {
  return database
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantSlug, tenantSlug),
        eq(appointments.date, day),
        eq(appointments.status, ACTIONABLE_APPOINTMENT_STATUS),
      ),
    )
    .orderBy(asc(appointments.slotTime));
}

/**
 * Sends what is due for tomorrow: each citizen's reminder and the office's
 * summary. Safe to call as often as anyone likes: each one goes once. Best
 * effort, like every e-mail here: a failure is logged, the next run does not
 * retry a reminder already claimed (a second copy is worse than none).
 */
export async function sendDueReminders(
  tenant: Tenant,
  now: AgendaNow,
  database: Database = db,
): Promise<{ citizens: number; summary: boolean }> {
  const day = reminderDay(now);
  const claimed = await claimDueRemindersWith(database, tenant.slug, day);
  for (const appointment of claimed) {
    // A desk booking may have no e-mail: the claim still marks it, so it is
    // not looked at again.
    if (appointment.email) {
      await sendAppointmentReminderEmail(tenant, appointment);
    }
  }

  let summary = false;
  const booked = await bookedOnWith(database, tenant.slug, day);
  if (
    booked.length > 0 &&
    tenant.contacts.email &&
    (await claimDaySummaryWith(database, tenant.slug, day))
  ) {
    await sendOfficeDaySummaryEmail(tenant, day, booked);
    summary = true;
  }
  return { citizens: claimed.length, summary };
}

/** When each office last ran the backup, in this server instance. */
const lastBackupRun = new Map<string, number>();
const BACKUP_INTERVAL_MS = 10 * 60 * 1000;

/**
 * The backup for the daily job, run as the panel opens: at most once every
 * ten minutes per office and server instance, after the response, never in
 * its way. An office whose job is not configured still gets its reminders
 * the day someone opens the panel.
 */
export async function sendDueRemindersInBackground(
  tenant: Tenant,
  now: AgendaNow,
): Promise<void> {
  const last = lastBackupRun.get(tenant.slug) ?? 0;
  if (Date.now() - last < BACKUP_INTERVAL_MS) return;
  lastBackupRun.set(tenant.slug, Date.now());
  try {
    await sendDueReminders(tenant, now);
  } catch (error) {
    console.error("agenda.reminders.backup", tenant.slug, error);
  }
}

export interface AgendaAlertItem {
  id: string;
  agenda: string;
  agendaName: string;
  date: IsoDate;
  slotTime: string;
  citizenName: string;
  serviceLabel: string;
  /** ISO instant the booking was made. */
  createdAt: string;
  /** By video or phone: no attendance declaration for it. */
  remote: boolean;
}

export interface AgendaAlertSnapshot {
  /** The office's own clock, so the panel never guesses a time zone. */
  now: AgendaNow;
  /** Today's live appointments, by time. */
  today: AgendaAlertItem[];
  /** Bookings made on the site in the last two days, newest first. */
  recent: AgendaAlertItem[];
  /** Appointments whose time is over and nobody marked attended or not. */
  pending: AgendaAlertItem[];
}

function alertItem(appointment: Appointment): AgendaAlertItem {
  const agenda = agendaIdOf(appointment.agenda);
  return {
    id: appointment.id,
    agenda,
    agendaName: AGENDA_NAMES[agenda].short,
    date: appointment.date,
    slotTime: appointment.slotTime,
    citizenName: appointment.citizenName,
    serviceLabel: appointment.serviceLabel,
    createdAt: appointment.createdAt.toISOString(),
    remote: isRemoteMode(appointment.mode),
  };
}

/** What the panel's agenda reminders read on every poll: two small queries. */
export async function agendaAlertSnapshotWith(
  database: Database,
  tenantSlug: string,
  now: AgendaNow,
): Promise<AgendaAlertSnapshot> {
  const [today, recent, pending] = await Promise.all([
    bookedOnWith(database, tenantSlug, now.date),
    database
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.tenantSlug, tenantSlug),
          eq(appointments.origin, "site"),
          eq(appointments.status, ACTIONABLE_APPOINTMENT_STATUS),
          gt(appointments.createdAt, sql`now() - interval '2 days'`),
        ),
      )
      .orderBy(desc(appointments.createdAt))
      .limit(10),
    awaitingConfirmationWith(database, tenantSlug, now),
  ]);
  return {
    now,
    today: today.map(alertItem),
    recent: recent.map(alertItem),
    pending: pending.map(alertItem),
  };
}

/** How far back an unconfirmed appointment is still asked about. */
export const CONFIRMATION_WINDOW_DAYS = 30;

/**
 * Appointments whose hour is over and that are still "booked": the office
 * has not said whether the citizen came. Today's count once their end time
 * has passed; earlier days, all of them, up to a month back (older ones
 * are history, not a task).
 */
export async function awaitingConfirmationWith(
  database: Database,
  tenantSlug: string,
  now: AgendaNow,
): Promise<Appointment[]> {
  const rows = await database
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantSlug, tenantSlug),
        eq(appointments.status, ACTIONABLE_APPOINTMENT_STATUS),
        sql`${appointments.date} between ${addDays(now.date, -CONFIRMATION_WINDOW_DAYS)} and ${now.date}`,
      ),
    )
    .orderBy(asc(appointments.date), asc(appointments.slotTime));
  return rows.filter(
    (row) => row.date < now.date || slotEndTime(row.slotTime) <= now.time,
  );
}

/** The production singleton, for the agenda page. */
export async function awaitingConfirmation(
  tenantSlug: string,
  now: AgendaNow,
): Promise<Appointment[]> {
  return awaitingConfirmationWith(db, tenantSlug, now);
}
