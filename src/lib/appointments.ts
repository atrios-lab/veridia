import "server-only";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { emailsMatch } from "@/core/email/match.ts";
import {
  generateAccessKey,
  hashAccessKey,
  verifyAccessKey,
} from "@/core/request/access-key.ts";
import { formatProtocolNumber } from "@/core/request/protocol.ts";
import {
  type AgendaBook,
  type AgendaConfig,
  type AgendaId,
  capacityAt,
  parseAgendaConfig,
  serializeAgendaConfig,
} from "@/core/scheduling/agenda.ts";
import {
  ACTIONABLE_APPOINTMENT_STATUS,
  type AppointmentOrigin,
  hashCancelToken,
  SLOT_HOLDING_STATUSES,
} from "@/core/scheduling/appointment.ts";
import { type IsoDate, weekday } from "@/core/scheduling/calendar.ts";
import type { SlotTime, TakenTimes } from "@/core/scheduling/slots.ts";
import { officeYear } from "@/core/time/office-time.ts";
import {
  isPostgresError,
  UNIQUE_VIOLATION,
  violatedConstraint,
} from "@/db/errors.ts";
import { type Database, db } from "@/db/index.ts";
import {
  appointmentAttachments,
  appointmentNotes,
  appointments,
  tenantContent,
} from "@/db/schema.ts";
import { OFFICE_AGENDA_KEY } from "@/lib/office-config.ts";
import { recordAudit, recordAuditWith } from "./audit.ts";
import { findPermanentBounceWith } from "./email/bounces.ts";
import type { StoredAttachment } from "./uploads.ts";

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
  const published = serializeAgendaConfig(config);
  await db
    .insert(tenantContent)
    .values({
      tenantSlug,
      key: OFFICE_AGENDA_KEY,
      published,
      publishedAt: now,
      updatedBy: actorId,
    })
    .onConflictDoUpdate({
      target: [tenantContent.tenantSlug, tenantContent.key],
      set: {
        published,
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
 * Whether the two agendas share one set of times. They did while the slot
 * index held one live appointment per office, day and time; the index is
 * per vacancy now (`appointments_tenant_date_slot_seat_live`), each agenda
 * counts its own appointments against its own vacancies, and a vacancy
 * number is only ever taken once at a time across both.
 */
export const AGENDAS_SHARE_TIMES = false;

/**
 * Which times are already taken, per day, over a range, in one agenda. Only
 * a cancellation gives a time back, the same rule the partial unique index
 * enforces on the way in, so the page never offers what the insert would
 * refuse.
 */
export async function takenTimesByDay(
  tenantSlug: string,
  from: IsoDate,
  to: IsoDate,
  agenda: AgendaId = "geral",
  /** The agenda's vacancies per time; absent, every time takes one. */
  book?: Pick<AgendaBook, "slotCapacity">,
): Promise<Map<IsoDate, TakenTimes>> {
  const rows = await db
    .select({ date: appointments.date, slotTime: appointments.slotTime })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantSlug, tenantSlug),
        AGENDAS_SHARE_TIMES ? undefined : eq(appointments.agenda, agenda),
        inArray(appointments.status, [...SLOT_HOLDING_STATUSES]),
        sql`${appointments.date} between ${from} and ${to}`,
      ),
    );

  // A time is taken once every vacancy of it is: counted per day and time,
  // against the agenda's capacity for that weekday.
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.date}|${row.slotTime}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const taken = new Map<IsoDate, Set<SlotTime>>();
  for (const [key, count] of counts) {
    const [date, slotTime] = key.split("|") as [IsoDate, SlotTime];
    const capacity = book ? capacityAt(book, weekday(date), slotTime) : 1;
    if (count < capacity) continue;
    const times = taken.get(date) ?? new Set<SlotTime>();
    times.add(slotTime);
    taken.set(date, times);
  }
  return taken;
}

/** Every appointment of a day, in the order the counter will see them. */
export async function appointmentsOnWith(
  database: Database,
  tenantSlug: string,
  date: IsoDate,
): Promise<Appointment[]> {
  return database
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantSlug, tenantSlug),
        eq(appointments.date, date),
        // Taken off the agenda by the office: kept, never listed.
        isNull(appointments.removedAt),
      ),
    )
    .orderBy(asc(appointments.slotTime), asc(appointments.createdAt));
}

/** The production singleton, for callers that do not test against it. */
export async function appointmentsOn(
  tenantSlug: string,
  date: IsoDate,
): Promise<Appointment[]> {
  return appointmentsOnWith(db, tenantSlug, date);
}

/** The appointment a cancellation link points at, still live. */
export async function findByCancelTokenWith(
  database: Database,
  tenantSlug: string,
  token: string,
): Promise<Appointment | undefined> {
  const [row] = await database
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

/** The production singleton, for callers that do not test against it. */
export async function findByCancelToken(
  tenantSlug: string,
  token: string,
): Promise<Appointment | undefined> {
  return findByCancelTokenWith(db, tenantSlug, token);
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
  /** Defaults to the counter's agenda. */
  agenda?: AgendaId;
  date: IsoDate;
  slotTime: SlotTime;
  citizenName: string;
  email: string;
  phone: string;
  cpf?: string;
  serviceId: string;
  serviceLabel: string;
  mode: string;
  /** The citizen's own words on what they need. Absent on a desk booking. */
  serviceDetails?: string;
  cancelTokenHash: string;
  /** The access key's hash, for the consult; absent on a desk booking. */
  accessKeyHash?: string;
  /** Defaults to "site": the citizen booked it themselves. */
  origin?: AppointmentOrigin;
}

/** The next AGD number of the office's year, same read as service-request:
 * max + 1, and the unique index settles any race. */
async function nextProtocolSequence(
  database: Database,
  tenantSlug: string,
  year: number,
): Promise<number> {
  const [last] = await database
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
export async function bookAppointmentWith(
  database: Database,
  tenantSlug: string,
  input: NewAppointment,
  actorId: string | null = null,
  /** How many citizens this time takes in this agenda; one by default. */
  capacity = 1,
): Promise<Appointment> {
  const year = officeYear(new Date());
  const origin = input.origin ?? "site";
  const agenda = input.agenda ?? "geral";

  // Two unique indexes referee this insert: the vacancy index (another
  // booking took this vacancy first: look again) and the protocol index
  // (another booking took this number first: ask for the next). The count
  // of the agenda's live appointments at this time, read inside the lock,
  // is what says the time is full.
  for (let attempt = 1; ; attempt++) {
    try {
      return await database.transaction(async (tx) => {
        // Bookings for the same office, day and time wait for each other
        // here, so two citizens never both read "one vacancy left".
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`${tenantSlug}|${input.date}|${input.slotTime}`}))`,
        );
        const live = await tx
          .select({ agenda: appointments.agenda, seat: appointments.seat })
          .from(appointments)
          .where(
            and(
              eq(appointments.tenantSlug, tenantSlug),
              eq(appointments.date, input.date),
              eq(appointments.slotTime, input.slotTime),
              inArray(appointments.status, [...SLOT_HOLDING_STATUSES]),
            ),
          );
        const inAgenda = live.filter((row) => row.agenda === agenda).length;
        if (inAgenda >= capacity) {
          throw new SlotTakenError("Este horário acabou de ser preenchido.");
        }
        // The first vacancy number nobody at this time holds, in either
        // agenda: the index is per office, day, time and vacancy.
        const used = new Set(live.map((row) => row.seat));
        let seat = 1;
        while (used.has(seat)) seat++;

        const sequence = await nextProtocolSequence(tx, tenantSlug, year);
        const [created] = await tx
          .insert(appointments)
          .values({
            tenantSlug,
            agenda,
            date: input.date,
            slotTime: input.slotTime,
            seat,
            citizenName: input.citizenName,
            email: input.email,
            phone: input.phone,
            cpf: input.cpf ?? null,
            serviceId: input.serviceId,
            serviceLabel: input.serviceLabel,
            mode: input.mode,
            serviceDetails: input.serviceDetails ?? null,
            cancelTokenHash: input.cancelTokenHash,
            accessKeyHash: input.accessKeyHash ?? null,
            origin,
            protocolYear: year,
            protocolSequence: sequence,
            protocolNumber: formatProtocolNumber("AGD", year, sequence),
          })
          .returning();

        await recordAuditWith(tx, {
          tenantSlug,
          // Null when booked by the citizen, who has no account by design.
          actorId,
          action:
            origin === "desk" ? "appointment.desk-book" : "appointment.book",
          targetType: "appointment",
          targetId: created.id,
        });
        return created;
      });
    } catch (error) {
      if (error instanceof SlotTakenError) throw error;
      if (!isPostgresError(error, UNIQUE_VIOLATION)) throw error;
      if (attempt >= PROTOCOL_ATTEMPTS) {
        const constraint = violatedConstraint(error);
        if (
          constraint === "appointments_tenant_year_sequence" ||
          constraint === "appointments_tenant_protocol"
        ) {
          throw error;
        }
        throw new SlotTakenError("Este horário acabou de ser preenchido.");
      }
      // A vacancy or a protocol number taken in the meantime: look again.
    }
  }
}

/** The production singleton, for callers that do not test against it. */
export async function bookAppointment(
  tenantSlug: string,
  input: NewAppointment,
  actorId: string | null = null,
  capacity = 1,
): Promise<Appointment> {
  return bookAppointmentWith(db, tenantSlug, input, actorId, capacity);
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
export async function cancelAppointmentWith(
  database: Database,
  tenantSlug: string,
  id: string,
  options: { reason?: string; actorId?: string } = {},
): Promise<Appointment | undefined> {
  const [cancelled] = await database
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
    await recordAuditWith(database, {
      tenantSlug,
      actorId: options.actorId ?? null,
      action: options.actorId ? "appointment.cancel" : "appointment.give-up",
      targetType: "appointment",
      targetId: id,
    });
  }
  return cancelled;
}

/** The production singleton, for callers that do not test against it. */
export async function cancelAppointment(
  tenantSlug: string,
  id: string,
  options: { reason?: string; actorId?: string } = {},
): Promise<Appointment | undefined> {
  return cancelAppointmentWith(db, tenantSlug, id, options);
}

/**
 * Closes a whole day: every live appointment on it is cancelled with the same
 * reason, in one statement. The rows come back so the caller can write to each
 * citizen. Sending is the caller's job, and a failed e-mail must not undo a
 * cancellation the office already decided.
 */
export async function cancelDayWith(
  database: Database,
  tenantSlug: string,
  date: IsoDate,
  reason: string,
  actorId: string,
): Promise<Appointment[]> {
  const cancelled = await database
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

  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "appointment.close-day",
    targetType: "agenda-day",
    targetId: date,
  });
  return cancelled;
}

/** The production singleton, for callers that do not test against it. */
export async function cancelDay(
  tenantSlug: string,
  date: IsoDate,
  reason: string,
  actorId: string,
): Promise<Appointment[]> {
  return cancelDayWith(db, tenantSlug, date, reason, actorId);
}

/** Marks the citizen as served. Same live guard: an appointment cancelled
 * this morning is not attended this afternoon. */
export async function markAttendedWith(
  database: Database,
  tenantSlug: string,
  id: string,
  actorId: string,
): Promise<void> {
  await database
    .update(appointments)
    .set({ status: "attended", updatedAt: new Date() })
    .where(
      and(
        eq(appointments.tenantSlug, tenantSlug),
        eq(appointments.id, id),
        eq(appointments.status, ACTIONABLE_APPOINTMENT_STATUS),
      ),
    );
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "appointment.attend",
    targetType: "appointment",
    targetId: id,
  });
}

/** The production singleton, for callers that do not test against it. */
export async function markAttended(
  tenantSlug: string,
  id: string,
  actorId: string,
): Promise<void> {
  return markAttendedWith(db, tenantSlug, id, actorId);
}

/** The citizen did not come. Same live guard as `markAttended`; no e-mail:
 * telling someone they missed what they missed serves nobody. */
export async function markNoShowWith(
  database: Database,
  tenantSlug: string,
  id: string,
  actorId: string,
): Promise<void> {
  await database
    .update(appointments)
    .set({ status: "no_show", updatedAt: new Date() })
    .where(
      and(
        eq(appointments.tenantSlug, tenantSlug),
        eq(appointments.id, id),
        eq(appointments.status, ACTIONABLE_APPOINTMENT_STATUS),
      ),
    );
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "appointment.no-show",
    targetType: "appointment",
    targetId: id,
  });
}

/** The production singleton, for callers that do not test against it. */
export async function markNoShow(
  tenantSlug: string,
  id: string,
  actorId: string,
): Promise<void> {
  return markNoShowWith(db, tenantSlug, id, actorId);
}

/** Non-cancelled appointments per day of a window, for the day strip's
 * "X de Y" occupancy. */
export async function liveCountsByDay(
  tenantSlug: string,
  from: IsoDate,
  to: IsoDate,
  agenda: AgendaId = "geral",
): Promise<Map<IsoDate, number>> {
  const rows = await db
    .select({ date: appointments.date, count: sql<number>`count(*)::int` })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantSlug, tenantSlug),
        eq(appointments.agenda, agenda),
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
  agenda: AgendaId = "geral",
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
        eq(appointments.agenda, agenda),
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

/**
 * Every appointment still booked from `from` on, both agendas, in date order.
 * The panel filters it through the office's calendar to find the ones that
 * fall on a day it no longer receives on: a holiday added after they were
 * booked, a law day switched back on, a weekday that lost its times.
 */
export async function bookedFrom(
  tenantSlug: string,
  from: IsoDate,
): Promise<Appointment[]> {
  return db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantSlug, tenantSlug),
        eq(appointments.status, ACTIONABLE_APPOINTMENT_STATUS),
        isNull(appointments.removedAt),
        sql`${appointments.date} >= ${from}`,
      ),
    )
    .orderBy(asc(appointments.date), asc(appointments.slotTime));
}

/** One appointment by id, any status, for the panel's printed receipt. */
export async function findAppointmentById(
  tenantSlug: string,
  id: string,
): Promise<Appointment | undefined> {
  // A malformed id is "not found", not a database error on a uuid cast.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  const [row] = await db
    .select()
    .from(appointments)
    .where(
      and(eq(appointments.tenantSlug, tenantSlug), eq(appointments.id, id)),
    )
    .limit(1);
  return row;
}

/* ------------------------------------------------------------- access key */

/**
 * The appointment behind an AGD protocol, but only when the key opens it:
 * the consult page's details and the documents sent ahead. An appointment
 * without a key (booked before keys, or reserved at the counter) opens to
 * nobody until the citizen recovers one with the booking's e-mail.
 */
export async function findAppointmentByProtocolWithKeyWith(
  database: Database,
  tenantSlug: string,
  protocolNumber: string,
  accessKey: string,
): Promise<Appointment | undefined> {
  const [row] = await database
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantSlug, tenantSlug),
        eq(appointments.protocolNumber, protocolNumber),
      ),
    )
    .limit(1);
  if (!row?.accessKeyHash || !verifyAccessKey(accessKey, row.accessKeyHash)) {
    return undefined;
  }
  return row;
}

export function findAppointmentByProtocolWithKey(
  tenantSlug: string,
  protocolNumber: string,
  accessKey: string,
): Promise<Appointment | undefined> {
  return findAppointmentByProtocolWithKeyWith(
    db,
    tenantSlug,
    protocolNumber,
    accessKey,
  );
}

/**
 * "Perdi a chave" for an appointment: a new key when the protocol and the
 * booking's e-mail match and the address takes mail, same rules as the
 * service request's. The old key stops opening it the moment this returns.
 */
export async function recoverAppointmentKeyWith(
  database: Database,
  tenantSlug: string,
  protocolNumber: string,
  email: string,
): Promise<{ reissued: boolean; accessKey?: string; email?: string }> {
  const [row] = await database
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantSlug, tenantSlug),
        eq(appointments.protocolNumber, protocolNumber),
      ),
    )
    .limit(1);
  if (!row || !emailsMatch(row.email, email)) return { reissued: false };
  if (await findPermanentBounceWith(database, row.email)) {
    return { reissued: false };
  }
  const accessKey = generateAccessKey();
  await database
    .update(appointments)
    .set({ accessKeyHash: hashAccessKey(accessKey), updatedAt: new Date() })
    .where(
      and(eq(appointments.tenantSlug, tenantSlug), eq(appointments.id, row.id)),
    );
  await recordAuditWith(database, {
    tenantSlug,
    actorId: null,
    action: "appointment.key-reissue",
    targetType: "appointment",
    targetId: row.id,
  });
  return { reissued: true, accessKey, email: row.email };
}

export function recoverAppointmentKey(
  tenantSlug: string,
  protocolNumber: string,
  email: string,
) {
  return recoverAppointmentKeyWith(db, tenantSlug, protocolNumber, email);
}

/* -------------------------------------------------------------- documents */

export type AppointmentAttachment = typeof appointmentAttachments.$inferSelect;

/** What the citizen sent ahead of an appointment, oldest first. */
/**
 * The files kept on appointments. `citizenOnly` is the consult's view: what
 * the citizen sent, never the office's own attachments (`uploadedBy` set).
 */
export async function listAppointmentAttachmentsWith(
  database: Database,
  tenantSlug: string,
  appointmentIds: string[],
  { citizenOnly = false }: { citizenOnly?: boolean } = {},
): Promise<AppointmentAttachment[]> {
  if (appointmentIds.length === 0) return [];
  return database
    .select()
    .from(appointmentAttachments)
    .where(
      and(
        eq(appointmentAttachments.tenantSlug, tenantSlug),
        inArray(appointmentAttachments.appointmentId, appointmentIds),
        citizenOnly ? isNull(appointmentAttachments.uploadedBy) : undefined,
      ),
    )
    .orderBy(asc(appointmentAttachments.createdAt));
}

export function listAppointmentAttachments(
  tenantSlug: string,
  appointmentIds: string[],
  options?: { citizenOnly?: boolean },
): Promise<AppointmentAttachment[]> {
  return listAppointmentAttachmentsWith(
    db,
    tenantSlug,
    appointmentIds,
    options,
  );
}

/** Files the citizen sent from the consult, kept on the appointment. */
export async function addAppointmentAttachmentsWith(
  database: Database,
  tenantSlug: string,
  appointmentId: string,
  files: StoredAttachment[],
): Promise<void> {
  if (files.length === 0) return;
  await database.insert(appointmentAttachments).values(
    files.map((file) => ({
      tenantSlug,
      appointmentId,
      storedName: file.storedName,
      displayName: file.displayName,
      path: file.path,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
    })),
  );
  // The consult refreshes on `updatedAt`: a new file is news.
  await database
    .update(appointments)
    .set({ updatedAt: new Date() })
    .where(
      and(
        eq(appointments.tenantSlug, tenantSlug),
        eq(appointments.id, appointmentId),
      ),
    );
  await recordAuditWith(database, {
    tenantSlug,
    actorId: null,
    action: "appointment.attach",
    targetType: "appointment",
    targetId: appointmentId,
  });
}

export function addAppointmentAttachments(
  tenantSlug: string,
  appointmentId: string,
  files: StoredAttachment[],
): Promise<void> {
  return addAppointmentAttachmentsWith(db, tenantSlug, appointmentId, files);
}

/** One file, for the panel to serve. */
export async function findAppointmentAttachment(
  tenantSlug: string,
  id: string,
): Promise<AppointmentAttachment | undefined> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  const [row] = await db
    .select()
    .from(appointmentAttachments)
    .where(
      and(
        eq(appointmentAttachments.tenantSlug, tenantSlug),
        eq(appointmentAttachments.id, id),
      ),
    )
    .limit(1);
  return row;
}

/* ------------------------------------------------------ undo and remove */

/**
 * "Desfazer": an appointment marked attended or no-show by mistake goes back
 * to booked, for the office to mark it right. False when it was neither.
 */
export async function revertAppointmentWith(
  database: Database,
  tenantSlug: string,
  id: string,
  actorId: string,
): Promise<boolean> {
  const reverted = await database
    .update(appointments)
    .set({ status: "booked", updatedAt: new Date() })
    .where(
      and(
        eq(appointments.tenantSlug, tenantSlug),
        eq(appointments.id, id),
        inArray(appointments.status, ["attended", "no_show"]),
        isNull(appointments.removedAt),
      ),
    )
    .returning({ id: appointments.id });
  if (reverted.length === 0) return false;
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "appointment.revert",
    targetType: "appointment",
    targetId: id,
  });
  return true;
}

export function revertAppointment(
  tenantSlug: string,
  id: string,
  actorId: string,
): Promise<boolean> {
  return revertAppointmentWith(db, tenantSlug, id, actorId);
}

/**
 * "Excluir": takes the appointment off the agenda, whatever its status.
 * Nothing is deleted: the row is cancelled (the hour is free again) and
 * marked removed, so it leaves every list but the record and the audit
 * trail stay. The citizen is not e-mailed: cancelling is the way to tell
 * them.
 */
export async function removeAppointmentWith(
  database: Database,
  tenantSlug: string,
  id: string,
  actorId: string,
): Promise<boolean> {
  const now = new Date();
  const removed = await database
    .update(appointments)
    .set({
      status: "cancelled",
      removedAt: now,
      // The database's own clock: a Date inside raw SQL is a parameter
      // the production driver will not serialise.
      cancelledAt: sql`coalesce(${appointments.cancelledAt}, now())`,
      updatedAt: now,
    })
    .where(
      and(
        eq(appointments.tenantSlug, tenantSlug),
        eq(appointments.id, id),
        isNull(appointments.removedAt),
      ),
    )
    .returning({ id: appointments.id });
  if (removed.length === 0) return false;
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "appointment.remove",
    targetType: "appointment",
    targetId: id,
  });
  return true;
}

export function removeAppointment(
  tenantSlug: string,
  id: string,
  actorId: string,
): Promise<boolean> {
  return removeAppointmentWith(db, tenantSlug, id, actorId);
}

/* ----------------------------------------------------- detail and notes */

export type AppointmentNote = typeof appointmentNotes.$inferSelect;

/** The office's notes on an appointment, oldest first. */
export async function listAppointmentNotesWith(
  database: Database,
  tenantSlug: string,
  appointmentId: string,
): Promise<AppointmentNote[]> {
  return database
    .select()
    .from(appointmentNotes)
    .where(
      and(
        eq(appointmentNotes.tenantSlug, tenantSlug),
        eq(appointmentNotes.appointmentId, appointmentId),
      ),
    )
    .orderBy(asc(appointmentNotes.createdAt));
}

export function listAppointmentNotes(
  tenantSlug: string,
  appointmentId: string,
): Promise<AppointmentNote[]> {
  return listAppointmentNotesWith(db, tenantSlug, appointmentId);
}

/** A note from the panel. Internal: the citizen never reads it. */
export async function addAppointmentNoteWith(
  database: Database,
  tenantSlug: string,
  appointmentId: string,
  author: { id: string; name: string },
  body: string,
): Promise<boolean> {
  const [appointment] = await database
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantSlug, tenantSlug),
        eq(appointments.id, appointmentId),
      ),
    )
    .limit(1);
  if (!appointment) return false;
  await database.insert(appointmentNotes).values({
    tenantSlug,
    appointmentId,
    authorId: author.id,
    authorName: author.name,
    body,
  });
  await recordAuditWith(database, {
    tenantSlug,
    actorId: author.id,
    action: "appointment.note",
    targetType: "appointment",
    targetId: appointmentId,
  });
  return true;
}

export function addAppointmentNote(
  tenantSlug: string,
  appointmentId: string,
  author: { id: string; name: string },
  body: string,
): Promise<boolean> {
  return addAppointmentNoteWith(db, tenantSlug, appointmentId, author, body);
}

/** Files the office keeps with the appointment; the consult never shows them. */
export async function addOfficeAppointmentAttachmentsWith(
  database: Database,
  tenantSlug: string,
  appointmentId: string,
  files: StoredAttachment[],
  actorId: string,
): Promise<void> {
  if (files.length === 0) return;
  await database.insert(appointmentAttachments).values(
    files.map((file) => ({
      tenantSlug,
      appointmentId,
      storedName: file.storedName,
      displayName: file.displayName,
      path: file.path,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      uploadedBy: actorId,
    })),
  );
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "appointment.office-attach",
    targetType: "appointment",
    targetId: appointmentId,
  });
}

export function addOfficeAppointmentAttachments(
  tenantSlug: string,
  appointmentId: string,
  files: StoredAttachment[],
  actorId: string,
): Promise<void> {
  return addOfficeAppointmentAttachmentsWith(
    db,
    tenantSlug,
    appointmentId,
    files,
    actorId,
  );
}

/** What the office may correct of what the citizen typed. */
export interface AppointmentCorrection {
  citizenName: string;
  email: string;
  phone: string;
  cpf: string | null;
  serviceId: string;
  serviceLabel: string;
  mode: string;
  serviceDetails: string | null;
}

/**
 * The office corrects the citizen's data (a misspelt name, a wrong CPF, the
 * service picked by mistake). Day, time and agenda are not here: moving an
 * appointment is cancelling and booking again, which frees and takes a
 * vacancy. Audited, like every other change the office makes.
 */
export async function correctAppointmentWith(
  database: Database,
  tenantSlug: string,
  id: string,
  correction: AppointmentCorrection,
  actorId: string,
): Promise<Appointment | undefined> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  const [row] = await database
    .update(appointments)
    .set({ ...correction, updatedAt: new Date() })
    .where(
      and(eq(appointments.tenantSlug, tenantSlug), eq(appointments.id, id)),
    )
    .returning();
  if (!row) return undefined;
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "appointment.correct",
    targetType: "appointment",
    targetId: id,
  });
  return row;
}

export function correctAppointment(
  tenantSlug: string,
  id: string,
  correction: AppointmentCorrection,
  actorId: string,
): Promise<Appointment | undefined> {
  return correctAppointmentWith(db, tenantSlug, id, correction, actorId);
}
