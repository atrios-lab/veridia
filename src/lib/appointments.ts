import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { formatProtocolNumber } from "@/core/request/protocol.ts";
import {
  type AgendaConfig,
  parseAgendaConfig,
} from "@/core/scheduling/agenda.ts";
import {
  ACTIONABLE_APPOINTMENT_STATUS,
  type AppointmentOrigin,
  hashCancelToken,
  SLOT_HOLDING_STATUSES,
} from "@/core/scheduling/appointment.ts";
import type { IsoDate } from "@/core/scheduling/calendar.ts";
import type { SlotTime, TakenTimes } from "@/core/scheduling/slots.ts";
import {
  isPostgresError,
  UNIQUE_VIOLATION,
  violatedConstraint,
} from "@/db/errors.ts";
import { db } from "@/db/index.ts";
import { appointments, tenantContent } from "@/db/schema.ts";
import { OFFICE_AGENDA_KEY } from "@/lib/tenant.ts";
import { recordAudit } from "./audit.ts";

export type Appointment = typeof appointments.$inferSelect;

/** The time was taken between rendering the page and pressing the button. The
 * database decided it, so the caller can say so honestly instead of guessing. */
export class SlotTakenError extends Error {}

/* ------------------------------------------------------------------- config */

/**
 * The office's agenda settings. Read directly, not through `getTenant()`'s
 * override merge: which Tuesdays a counter receives is operational state, not
 * branding or editorial content: same posture as `OFFICE_CHAT_KEY`.
 *
 * A database that is down returns the seed rather than throwing, which is an
 * agenda offering nothing instead of a page that will not load.
 */
export async function getAgendaConfig(
  tenantSlug: string,
): Promise<AgendaConfig> {
  try {
    const [row] = await db
      .select({ published: tenantContent.published })
      .from(tenantContent)
      .where(
        and(
          eq(tenantContent.tenantSlug, tenantSlug),
          eq(tenantContent.key, OFFICE_AGENDA_KEY),
        ),
      )
      .limit(1);
    return parseAgendaConfig(row?.published);
  } catch {
    return parseAgendaConfig(null);
  }
}

/**
 * Saves the agenda. Written straight to `published`, like the office's phone
 * number: a grid saved as a draft would be a counter open in a preview and
 * shut on the site.
 */
export async function saveAgendaConfig(
  tenantSlug: string,
  config: AgendaConfig,
  actorId: string,
): Promise<void> {
  const now = new Date();
  await db
    .insert(tenantContent)
    .values({
      tenantSlug,
      key: OFFICE_AGENDA_KEY,
      published: config,
      publishedAt: now,
      updatedBy: actorId,
    })
    .onConflictDoUpdate({
      target: [tenantContent.tenantSlug, tenantContent.key],
      set: {
        published: config,
        publishedAt: now,
        updatedAt: now,
        updatedBy: actorId,
      },
    });
  await recordAudit({
    tenantSlug,
    actorId,
    action: "agenda.settings",
    targetType: "agenda-settings",
  });
}

/* ------------------------------------------------------------------ reading */

/**
 * Which times are already taken, per day, over a range. Only a cancellation
 * gives a time back, the same rule the partial unique index enforces on the
 * way in, so the page never offers what the insert would refuse.
 */
export async function takenTimesByDay(
  tenantSlug: string,
  from: IsoDate,
  to: IsoDate,
): Promise<Map<IsoDate, TakenTimes>> {
  const rows = await db
    .select({ date: appointments.date, slotTime: appointments.slotTime })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantSlug, tenantSlug),
        inArray(appointments.status, [...SLOT_HOLDING_STATUSES]),
        sql`${appointments.date} between ${from} and ${to}`,
      ),
    );

  const taken = new Map<IsoDate, Set<SlotTime>>();
  for (const row of rows) {
    const times = taken.get(row.date) ?? new Set<SlotTime>();
    times.add(row.slotTime);
    taken.set(row.date, times);
  }
  return taken;
}

/** Every appointment of a day, in the order the counter will see them. */
export async function appointmentsOn(
  tenantSlug: string,
  date: IsoDate,
): Promise<Appointment[]> {
  return db
    .select()
    .from(appointments)
    .where(
      and(eq(appointments.tenantSlug, tenantSlug), eq(appointments.date, date)),
    )
    .orderBy(asc(appointments.slotTime), asc(appointments.createdAt));
}

/** The appointment a cancellation link points at, still live. */
export async function findByCancelToken(
  tenantSlug: string,
  token: string,
): Promise<Appointment | undefined> {
  const [row] = await db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantSlug, tenantSlug),
        eq(appointments.cancelTokenHash, hashCancelToken(token)),
        eq(appointments.status, ACTIONABLE_APPOINTMENT_STATUS),
      ),
    )
    .limit(1);
  return row;
}

/** How many appointments the office has booked from today on, for the sidebar
 * badge and the overview both ask this. */
export async function bookedCountFrom(
  tenantSlug: string,
  from: IsoDate,
): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantSlug, tenantSlug),
        eq(appointments.status, ACTIONABLE_APPOINTMENT_STATUS),
        sql`${appointments.date} >= ${from}`,
      ),
    );
  return row?.count ?? 0;
}

/* ------------------------------------------------------------------ writing */

export interface NewAppointment {
  date: IsoDate;
  slotTime: SlotTime;
  citizenName: string;
  email: string;
  phone: string;
  cpf?: string;
  serviceId: string;
  serviceLabel: string;
  mode: string;
  cancelTokenHash: string;
  /** Defaults to "site": the citizen booked it themselves. */
  origin?: AppointmentOrigin;
}

/** The next AGD number of the office's year, same read as service-request:
 * max + 1, and the unique index settles any race. */
async function nextProtocolSequence(
  tenantSlug: string,
  year: number,
): Promise<number> {
  const [last] = await db
    .select({ sequence: appointments.protocolSequence })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantSlug, tenantSlug),
        eq(appointments.protocolYear, year),
      ),
    )
    .orderBy(sql`${appointments.protocolSequence} desc nulls last`)
    .limit(1);
  return (last?.sequence ?? 0) + 1;
}

const PROTOCOL_ATTEMPTS = 5;

/**
 * Books the time. The partial unique index is the referee: two citizens on
 * the last slot both reach this, one row lands and the other comes back as
 * `SlotTakenError` for the page to explain. No lock, no count, no retry:
 * retrying would only book a time the citizen did not choose.
 */
export async function bookAppointment(
  tenantSlug: string,
  input: NewAppointment,
  actorId: string | null = null,
): Promise<Appointment> {
  const year = new Date().getFullYear();
  const origin = input.origin ?? "site";

  // Two unique indexes referee this insert, and they mean different things:
  // the slot index means the time is gone (tell the caller), the protocol
  // index means another booking took this number first (ask for the next).
  for (let attempt = 1; ; attempt++) {
    const sequence = await nextProtocolSequence(tenantSlug, year);
    try {
      const [created] = await db
        .insert(appointments)
        .values({
          tenantSlug,
          date: input.date,
          slotTime: input.slotTime,
          citizenName: input.citizenName,
          email: input.email,
          phone: input.phone,
          cpf: input.cpf ?? null,
          serviceId: input.serviceId,
          serviceLabel: input.serviceLabel,
          mode: input.mode,
          cancelTokenHash: input.cancelTokenHash,
          origin,
          protocolYear: year,
          protocolSequence: sequence,
          protocolNumber: formatProtocolNumber("AGD", year, sequence),
        })
        .returning();

      await recordAudit({
        tenantSlug,
        // Null when booked by the citizen, who has no account by design.
        actorId,
        action:
          origin === "desk" ? "appointment.desk-book" : "appointment.book",
        targetType: "appointment",
        targetId: created.id,
      });
      return created;
    } catch (error) {
      if (!isPostgresError(error, UNIQUE_VIOLATION)) throw error;
      const constraint = violatedConstraint(error);
      if (
        constraint === "appointments_tenant_year_sequence" ||
        constraint === "appointments_tenant_protocol"
      ) {
        if (attempt >= PROTOCOL_ATTEMPTS) throw error;
        continue;
      }
      throw new SlotTakenError("Este horário acabou de ser preenchido.");
    }
  }
}

/**
 * Cancels one appointment. `actorId` is null when the citizen cancelled it
 * from the e-mail link, and a reason only exists when the office did it, because the
 * citizen owes nobody an explanation for not coming.
 *
 * Returns the row as it was cancelled, so the caller can write the e-mail
 * without reading it back. Undefined when nothing live matched, which is what
 * a double-submitted link looks like.
 */
export async function cancelAppointment(
  tenantSlug: string,
  id: string,
  options: { reason?: string; actorId?: string } = {},
): Promise<Appointment | undefined> {
  const [cancelled] = await db
    .update(appointments)
    .set({
      status: "cancelled",
      cancelReason: options.reason ?? null,
      cancelledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(appointments.tenantSlug, tenantSlug),
        eq(appointments.id, id),
        // The guard, not a courtesy: it is what makes a link clicked twice
        // cancel once, and what stops an attended visit being undone.
        eq(appointments.status, ACTIONABLE_APPOINTMENT_STATUS),
      ),
    )
    .returning();

  if (cancelled) {
    await recordAudit({
      tenantSlug,
      actorId: options.actorId ?? null,
      action: options.actorId ? "appointment.cancel" : "appointment.give-up",
      targetType: "appointment",
      targetId: id,
    });
  }
  return cancelled;
}

/**
 * Closes a whole day: every live appointment on it is cancelled with the same
 * reason, in one statement. The rows come back so the caller can write to each
 * citizen. Sending is the caller's job, and a failed e-mail must not undo a
 * cancellation the office already decided.
 */
export async function cancelDay(
  tenantSlug: string,
  date: IsoDate,
  reason: string,
  actorId: string,
): Promise<Appointment[]> {
  const cancelled = await db
    .update(appointments)
    .set({
      status: "cancelled",
      cancelReason: reason,
      cancelledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(appointments.tenantSlug, tenantSlug),
        eq(appointments.date, date),
        eq(appointments.status, ACTIONABLE_APPOINTMENT_STATUS),
      ),
    )
    .returning();

  await recordAudit({
    tenantSlug,
    actorId,
    action: "appointment.close-day",
    targetType: "agenda-day",
    targetId: date,
  });
  return cancelled;
}

/** Marks the citizen as served. Same live guard: an appointment cancelled
 * this morning is not attended this afternoon. */
export async function markAttended(
  tenantSlug: string,
  id: string,
  actorId: string,
): Promise<void> {
  await db
    .update(appointments)
    .set({ status: "attended", updatedAt: new Date() })
    .where(
      and(
        eq(appointments.tenantSlug, tenantSlug),
        eq(appointments.id, id),
        eq(appointments.status, ACTIONABLE_APPOINTMENT_STATUS),
      ),
    );
  await recordAudit({
    tenantSlug,
    actorId,
    action: "appointment.attend",
    targetType: "appointment",
    targetId: id,
  });
}

/** The citizen did not come. Same live guard as `markAttended`; no e-mail:
 * telling someone they missed what they missed serves nobody. */
export async function markNoShow(
  tenantSlug: string,
  id: string,
  actorId: string,
): Promise<void> {
  await db
    .update(appointments)
    .set({ status: "no_show", updatedAt: new Date() })
    .where(
      and(
        eq(appointments.tenantSlug, tenantSlug),
        eq(appointments.id, id),
        eq(appointments.status, ACTIONABLE_APPOINTMENT_STATUS),
      ),
    );
  await recordAudit({
    tenantSlug,
    actorId,
    action: "appointment.no-show",
    targetType: "appointment",
    targetId: id,
  });
}

/** Non-cancelled appointments per day of a window, for the day strip's
 * "X de Y" occupancy. */
export async function liveCountsByDay(
  tenantSlug: string,
  from: IsoDate,
  to: IsoDate,
): Promise<Map<IsoDate, number>> {
  const rows = await db
    .select({ date: appointments.date, count: sql<number>`count(*)::int` })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantSlug, tenantSlug),
        sql`${appointments.status} <> 'cancelled'`,
        sql`${appointments.date} between ${from} and ${to}`,
      ),
    )
    .groupBy(appointments.date);
  return new Map(rows.map((row) => [row.date, row.count]));
}

/**
 * Live future appointments counted by (weekday, time), so the settings form
 * can warn before a chip with people behind it is removed.
 */
export async function futureLiveByWeekdayTime(
  tenantSlug: string,
  from: IsoDate,
): Promise<Record<string, number>> {
  const rows = await db
    .select({
      // Postgres dow: 0 is Sunday, same numbering as core's weekday().
      day: sql<number>`extract(dow from ${appointments.date})::int`,
      slotTime: appointments.slotTime,
      count: sql<number>`count(*)::int`,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantSlug, tenantSlug),
        eq(appointments.status, ACTIONABLE_APPOINTMENT_STATUS),
        sql`${appointments.date} >= ${from}`,
      ),
    )
    .groupBy(sql`1`, appointments.slotTime);
  return Object.fromEntries(
    rows.map((row) => [`${row.day}|${row.slotTime}`, row.count]),
  );
}

/** The appointment a public AGD protocol lookup names. Any status: the point
 * of the lookup is to answer what became of it. */
export async function findAppointmentByProtocol(
  tenantSlug: string,
  protocolNumber: string,
): Promise<Appointment | undefined> {
  const [row] = await db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantSlug, tenantSlug),
        eq(appointments.protocolNumber, protocolNumber),
      ),
    )
    .limit(1);
  return row;
}

/**
 * The live appointments of a set of days, for the panel to warn what closing
 * a date is about to cancel.
 */
export async function liveAppointmentsOn(
  tenantSlug: string,
  dates: IsoDate[],
): Promise<Appointment[]> {
  if (dates.length === 0) return [];
  return db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantSlug, tenantSlug),
        eq(appointments.status, ACTIONABLE_APPOINTMENT_STATUS),
        inArray(appointments.date, dates),
      ),
    )
    .orderBy(asc(appointments.date), asc(appointments.slotTime));
}
