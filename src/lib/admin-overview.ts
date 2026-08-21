import "server-only";
import {
  and,
  desc,
  eq,
  exists,
  inArray,
  notExists,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { dataRightsDayOfDeadline } from "@/core/request/channels.ts";
import {
  isOpenStatus,
  REQUEST_KINDS,
  type RequestKind,
  TERMINAL_STATUSES,
} from "@/core/request/kinds.ts";
import type { IsoDate } from "@/core/scheduling/calendar.ts";
import { user } from "@/db/auth-schema.ts";
import { db } from "@/db/index.ts";
import {
  appointments,
  auditLog,
  serviceRequestRequirements,
  serviceRequests,
} from "@/db/schema.ts";

export interface RecentActivityEntry {
  action: string;
  kind: RequestKind;
  protocolNumber: string | null;
  applicantName: string | null;
  actorName: string | null;
  createdAt: Date;
}

/**
 * The most recent events across every channel the session may see, newest
 * first. Joined on `id` OR `protocolNumber`, same ambiguity
 * `listRecordHistory` already resolves for one record's own history: a
 * row's creation is audited under its protocol, before the row (and so its
 * id) exists.
 *
 * `service-request.delete`'s audit entry has no matching row by design (the
 * row is gone): it joins to nothing, and the caller's sentence map falls
 * back to a generic label when `protocolNumber` comes back null.
 */
export async function listRecentActivity(
  tenantSlug: string,
  kinds: readonly RequestKind[],
  limit: number,
): Promise<RecentActivityEntry[]> {
  if (kinds.length === 0) return [];
  const rows = await db
    .select({
      action: auditLog.action,
      kind: auditLog.targetType,
      protocolNumber: serviceRequests.protocolNumber,
      applicantName: serviceRequests.applicantName,
      actorName: user.name,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(user, eq(auditLog.actorId, user.id))
    .leftJoin(
      serviceRequests,
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        or(
          // `id` is uuid, `target_id` is text: an explicit cast, since
          // Postgres will not compare the two types on its own.
          eq(sql`${serviceRequests.id}::text`, auditLog.targetId),
          eq(serviceRequests.protocolNumber, auditLog.targetId),
        ),
      ),
    )
    .where(
      and(
        eq(auditLog.tenantSlug, tenantSlug),
        inArray(auditLog.targetType, kinds),
      ),
    )
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
  return rows.map((row) => ({ ...row, kind: row.kind as RequestKind }));
}

export interface UpcomingDataRightsDeadline {
  id: string;
  protocolNumber: string;
  applicantName: string | null;
  daysLeft: number;
}

/** Open LGPD requerimentos within three days of the legal term, overdue ones
 * included: the same horizon `DeadlineBadge` uses, closest deadline first. */
export async function listUpcomingDataRightsDeadlines(
  tenantSlug: string,
  today: IsoDate,
): Promise<UpcomingDataRightsDeadline[]> {
  const rows = await db
    .select({
      id: serviceRequests.id,
      protocolNumber: serviceRequests.protocolNumber,
      applicantName: serviceRequests.applicantName,
      createdAt: serviceRequests.createdAt,
    })
    .from(serviceRequests)
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.kind, "data-rights"),
        eq(serviceRequests.status, "new"),
      ),
    );

  return rows
    .map((row) => {
      const requestedOn = row.createdAt.toISOString().slice(0, 10);
      const dayOfTerm = dataRightsDayOfDeadline(requestedOn, today);
      return {
        id: row.id,
        protocolNumber: row.protocolNumber,
        applicantName: row.applicantName,
        daysLeft: 15 - dayOfTerm,
      };
    })
    .filter((row) => row.daysLeft <= 3)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export interface StalledRequest {
  id: string;
  protocolNumber: string;
  applicantName: string | null;
}

/**
 * Service requests still "Em análise" whose most recent exigência was
 * cumprida but whose andamento has not moved since: the operator's turn,
 * waiting.
 */
export async function listStalledFulfilledRequirements(
  tenantSlug: string,
): Promise<StalledRequest[]> {
  const fulfilled = db
    .select()
    .from(serviceRequestRequirements)
    .where(
      and(
        eq(serviceRequestRequirements.requestId, serviceRequests.id),
        eq(serviceRequestRequirements.status, "fulfilled"),
      ),
    );
  const pending = db
    .select()
    .from(serviceRequestRequirements)
    .where(
      and(
        eq(serviceRequestRequirements.requestId, serviceRequests.id),
        eq(serviceRequestRequirements.status, "pending"),
      ),
    );

  return db
    .select({
      id: serviceRequests.id,
      protocolNumber: serviceRequests.protocolNumber,
      applicantName: serviceRequests.applicantName,
    })
    .from(serviceRequests)
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.kind, "service-request"),
        eq(serviceRequests.status, "in-review"),
        exists(fulfilled),
        notExists(pending),
      ),
    );
}

/** How the overview's colored chip names each channel. */
export const CHANNEL_CHIP_LABELS: Record<RequestKind, string> = {
  "service-request": "Pedido",
  appointment: "Agenda",
  "data-rights": "LGPD",
  ombudsman: "Ouvidoria",
};

export const ACTIVITY_VERBS: Record<string, string> = {
  "service-request.create": "enviou um novo pedido de serviço",
  "service-request.status": "mudou o andamento do pedido",
  "service-request.requirement.register": "registrou uma exigência no pedido",
  "service-request.requirement.fulfill": "cumpriu uma exigência do pedido",
  "service-request.amount": "informou o valor do pedido",
  "service-request.key-reissue": "emitiu uma nova chave de acesso",
  "service-request.delete": "excluiu um pedido",
  "appointment.book": "agendou um atendimento",
  "appointment.give-up": "cancelou o próprio agendamento",
  "appointment.cancel": "cancelou um agendamento",
  "appointment.close-day": "fechou um dia da agenda",
  "appointment.attend": "marcou o atendimento como realizado",
  "appointment.no-show": "registrou a falta do cidadão",
  "appointment.desk-book": "reservou um horário no balcão",
  "agenda.settings": "alterou a configuração da agenda",
  "data-rights.create": "registrou um requerimento LGPD",
  "data-rights.respond": "respondeu ao titular",
  "data-rights.draft": "salvou um rascunho de resposta",
  "ombudsman.create": "registrou uma manifestação",
  "ombudsman.respond": "respondeu à manifestação",
  "ombudsman.draft": "salvou um rascunho de resposta",
  "ombudsman.internal-note": "salvou uma anotação interna",
};

/**
 * The sentence a row of `listRecentActivity` reads as. The subject is
 * whoever acted: the operator when the action carries one, the citizen's own
 * name otherwise (creation and citizen-side writes have no `actorId`):
 * exactly like the design's activity feed mixes both.
 */
export function activitySentence(entry: RecentActivityEntry): string {
  const subject = entry.actorName ?? entry.applicantName ?? "Alguém";
  const verb = ACTIVITY_VERBS[entry.action] ?? "registrou um evento";
  return entry.protocolNumber
    ? `${subject} ${verb} (${entry.protocolNumber})`
    : `${subject} ${verb}`;
}

export interface DeskRecord {
  kind: RequestKind;
  id: string;
  protocolNumber: string;
  applicantName: string | null;
  status: string;
  createdAt: Date;
  details: unknown;
  /** Only ever true for `service-request`: an exigência was cumprida and
   * none is still pending (see `listStalledFulfilledRequirements`). */
  hasFulfilledPendingRequirement: boolean;
}

/**
 * Every open record of the channels the session may see: the raw material
 * for "Sua mesa hoje". Ranking (urgency, chip, next step) is
 * `rankDeskItems`'s job in `src/core/overview/desk.ts`, not this query's:
 * this only fetches what still needs the operator's attention.
 */
export async function listDeskItems(
  tenantSlug: string,
  kinds: readonly RequestKind[],
): Promise<DeskRecord[]> {
  if (kinds.length === 0) return [];

  const [rows, stalled] = await Promise.all([
    db
      .select({
        id: serviceRequests.id,
        kind: serviceRequests.kind,
        protocolNumber: serviceRequests.protocolNumber,
        applicantName: serviceRequests.applicantName,
        status: serviceRequests.status,
        createdAt: serviceRequests.createdAt,
        details: serviceRequests.details,
      })
      .from(serviceRequests)
      .where(
        and(
          eq(serviceRequests.tenantSlug, tenantSlug),
          or(
            ...kinds.map((kind) =>
              and(
                eq(serviceRequests.kind, kind),
                notInArray(serviceRequests.status, [
                  ...TERMINAL_STATUSES[kind],
                ]),
              ),
            ),
          ),
        ),
      ),
    kinds.includes("service-request")
      ? listStalledFulfilledRequirements(tenantSlug)
      : Promise.resolve([]),
  ]);

  const stalledIds = new Set(stalled.map((row) => row.id));
  return rows.map((row) => ({
    ...row,
    kind: row.kind as RequestKind,
    hasFulfilledPendingRequirement: stalledIds.has(row.id),
  }));
}

export interface TodayAppointmentRecord {
  id: string;
  citizenName: string;
  serviceLabel: string;
  slotTime: string;
  status: string;
}

/** Today's appointments (office time zone), on the wall calendar the office
 * reads. Cancelled ones excluded, already-attended kept so the day's list
 * reads complete. */
export async function listTodayAppointments(
  tenantSlug: string,
  todayIso: IsoDate,
): Promise<TodayAppointmentRecord[]> {
  return db
    .select({
      id: appointments.id,
      citizenName: appointments.citizenName,
      serviceLabel: appointments.serviceLabel,
      slotTime: appointments.slotTime,
      status: appointments.status,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantSlug, tenantSlug),
        eq(appointments.date, todayIso),
        notInArray(appointments.status, ["cancelled"]),
      ),
    );
}

export interface ResumePoint {
  kind: RequestKind;
  protocolNumber: string;
  applicantName: string | null;
  action: string;
}

/**
 * The most recent item the session's own user acted on that is still open:
 * "Continuar de onde parou". Same id-or-protocol join `listRecentActivity`
 * already resolves; scanned in memory because "still open" depends on
 * `isOpenStatus`, which is per-kind logic no SQL `WHERE` here should carry.
 */
export async function findResumePoint(
  tenantSlug: string,
  userId: string,
): Promise<ResumePoint | undefined> {
  const rows = await db
    .select({
      action: auditLog.action,
      kind: auditLog.targetType,
      protocolNumber: serviceRequests.protocolNumber,
      applicantName: serviceRequests.applicantName,
      status: serviceRequests.status,
    })
    .from(auditLog)
    .innerJoin(
      serviceRequests,
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        or(
          eq(sql`${serviceRequests.id}::text`, auditLog.targetId),
          eq(serviceRequests.protocolNumber, auditLog.targetId),
        ),
      ),
    )
    .where(
      and(eq(auditLog.tenantSlug, tenantSlug), eq(auditLog.actorId, userId)),
    )
    .orderBy(desc(auditLog.createdAt))
    .limit(20);

  const open = rows.find(
    (row) =>
      (REQUEST_KINDS as readonly string[]).includes(row.kind) &&
      isOpenStatus(row.kind as RequestKind, row.status),
  );
  if (!open) return undefined;
  return {
    kind: open.kind as RequestKind,
    protocolNumber: open.protocolNumber,
    applicantName: open.applicantName,
    action: open.action,
  };
}
