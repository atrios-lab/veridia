import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import {
  closingReason,
  pendingDays,
  reminderDue,
} from "@/core/ri/protocol-days.ts";
import type { OfficeHolidays } from "@/core/scheduling/calendar.ts";
import { OFFICE_TIME_ZONE } from "@/core/time/office-time.ts";
import type { Database } from "@/db/index.ts";
import { riBooks, riProtocolDays, riProtocols } from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import { type Actor, RiError } from "./ri.ts";
import { officeToday } from "./ri-protocols.ts";

/**
 * The days of the Protocolo closed (Lei nº 6.015/1973, art. 184), each on
 * its own date, even when the office closes the week on Friday (decision
 * of 26/11/2026). Nothing is deleted: reopening marks the row.
 */

export type ProtocolDayRow = typeof riProtocolDays.$inferSelect;

/** The closings in force (not reopened), by day. */
export async function closedDaysWith(
  database: Database,
  tenantSlug: string,
): Promise<Map<string, ProtocolDayRow>> {
  const rows = await database
    .select()
    .from(riProtocolDays)
    .where(
      and(
        eq(riProtocolDays.tenantSlug, tenantSlug),
        isNull(riProtocolDays.reopenedAt),
      ),
    );
  return new Map(rows.map((r) => [r.day, r]));
}

export async function isDayClosedWith(
  database: Database,
  tenantSlug: string,
  day: string,
): Promise<boolean> {
  const [row] = await database
    .select({ id: riProtocolDays.id })
    .from(riProtocolDays)
    .where(
      and(
        eq(riProtocolDays.tenantSlug, tenantSlug),
        eq(riProtocolDays.day, day),
        isNull(riProtocolDays.reopenedAt),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * Where the Protocolo starts counting: the Livro 1 opened, or the first
 * prenotação. Without either, nothing is pending.
 */
async function startOf(
  database: Database,
  tenantSlug: string,
): Promise<string | null> {
  const books = await database
    .select({ openedOn: riBooks.openedOn, deletedAt: riBooks.deletedAt })
    .from(riBooks)
    .where(and(eq(riBooks.tenantSlug, tenantSlug), eq(riBooks.book, 1)));
  const protocols = await database
    .select({ presentedOn: riProtocols.presentedOn })
    .from(riProtocols)
    .where(
      and(
        eq(riProtocols.tenantSlug, tenantSlug),
        eq(riProtocols.kind, "prenotacao"),
      ),
    );
  const dates = [
    ...books.filter((b) => !b.deletedAt).map((b) => b.openedOn),
    ...protocols.map((p) => p.presentedOn),
  ].sort();
  return dates[0] ?? null;
}

/** The days still open, from the start of the Protocolo to today. */
export async function pendingDaysWith(
  database: Database,
  tenantSlug: string,
  today = officeToday(),
): Promise<string[]> {
  const start = await startOf(database, tenantSlug);
  if (!start) return [];
  const closed = await closedDaysWith(database, tenantSlug);
  // The last 400 days at most: older gaps are shown, not reminded.
  return pendingDays(start, today, new Set(closed.keys()));
}

export function officeHour(now = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: OFFICE_TIME_ZONE,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
}

/** What the reminder shows (14h on, or any day before today open). */
export async function protocolReminderWith(
  database: Database,
  tenantSlug: string,
  now = new Date(),
) {
  const today = officeToday(now);
  const pending = await pendingDaysWith(database, tenantSlug, today);
  return reminderDue({ today, hour: officeHour(now), pending });
}

/**
 * Closes the open days from `from` to `to` (inclusive), each with its own
 * date: the títulos of the day, or why there were none.
 */
export async function closeDaysWith(
  database: Database,
  tenantSlug: string,
  input: { from: string; to: string },
  holidays: OfficeHolidays,
  actor: Actor,
  today = officeToday(),
): Promise<number> {
  if (input.from > input.to) {
    throw new RiError("A data inicial é depois da final.");
  }
  if (input.to > today) {
    throw new RiError("Não dá para encerrar um dia que ainda não chegou.");
  }
  const closed = await closedDaysWith(database, tenantSlug);
  const days = pendingDays(input.from, input.to, new Set(closed.keys()), 800);
  if (days.length === 0) return 0;
  const entries = await database
    .select({
      number: riProtocols.number,
      presentedOn: riProtocols.presentedOn,
      voidedAt: riProtocols.voidedAt,
    })
    .from(riProtocols)
    .where(
      and(
        eq(riProtocols.tenantSlug, tenantSlug),
        eq(riProtocols.kind, "prenotacao"),
      ),
    );
  for (const day of days) {
    const numbers = entries
      .filter((e) => e.presentedOn === day && !e.voidedAt)
      .map((e) => e.number)
      .sort((a, b) => a - b);
    const reason = closingReason(day, numbers.length, holidays);
    await database.insert(riProtocolDays).values({
      tenantSlug,
      day,
      kind: reason.kind,
      why: reason.why,
      count: numbers.length,
      firstNumber: numbers[0] ?? null,
      lastNumber: numbers.at(-1) ?? null,
      closedBy: actor.id,
    });
  }
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.protocol-day-close",
    targetType: "ri-protocol-day",
    targetId: null,
    reason:
      days.length === 1
        ? `Dia ${days[0]}`
        : `${days.length} dias, de ${days[0]} a ${days.at(-1)}`,
  });
  return days.length;
}

/** Reopens a closed day (with the reason): it takes prenotações again. */
export async function reopenDayWith(
  database: Database,
  tenantSlug: string,
  day: string,
  reason: string,
  actor: Actor,
): Promise<void> {
  const [row] = await database
    .select()
    .from(riProtocolDays)
    .where(
      and(
        eq(riProtocolDays.tenantSlug, tenantSlug),
        eq(riProtocolDays.day, day),
        isNull(riProtocolDays.reopenedAt),
      ),
    )
    .limit(1);
  if (!row) throw new RiError("Este dia não está encerrado.");
  await database
    .update(riProtocolDays)
    .set({
      reopenedAt: new Date(),
      reopenedBy: actor.id,
      reopenReason: reason.slice(0, 2000),
    })
    .where(eq(riProtocolDays.id, row.id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.protocol-day-reopen",
    targetType: "ri-protocol-day",
    targetId: row.id,
  });
}
