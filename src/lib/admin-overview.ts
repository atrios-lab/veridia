import "server-only";
import {
  and,
  desc,
  eq,
  exists,
  inArray,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import { dataRightsDayOfDeadline } from "@/core/request/channels.ts";
import type { RequestKind } from "@/core/request/kinds.ts";
import type { IsoDate } from "@/core/scheduling/calendar.ts";
import { user } from "@/db/auth-schema.ts";
import { db } from "@/db/index.ts";
import {
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
 * row is gone) — it joins to nothing, and the caller's sentence map falls
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
 * included — the same horizon `DeadlineBadge` uses, closest deadline first. */
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
 * cumprida but whose andamento has not moved since — the operator's turn,
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

const ACTIVITY_VERBS: Record<string, string> = {
  "service-request.create": "enviou um novo pedido de serviço",
  "service-request.status": "mudou o andamento do pedido",
  "service-request.requirement.register": "registrou uma exigência no pedido",
  "service-request.requirement.fulfill": "cumpriu uma exigência do pedido",
  "service-request.amount": "informou o valor do pedido",
  "service-request.key-reissue": "emitiu uma nova chave de acesso",
  "service-request.delete": "excluiu um pedido",
  "appointment.create": "pediu um horário",
  "appointment.confirm": "confirmou o horário",
  "appointment.propose": "propôs outro horário",
  "appointment.cancel": "cancelou o pedido de horário",
  "appointment.attend": "marcou o atendimento como realizado",
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
 * name otherwise (creation and citizen-side writes have no `actorId`) —
 * exactly like the design's activity feed mixes both.
 */
export function activitySentence(entry: RecentActivityEntry): string {
  const subject = entry.actorName ?? entry.applicantName ?? "Alguém";
  const verb = ACTIVITY_VERBS[entry.action] ?? "registrou um evento";
  return entry.protocolNumber
    ? `${subject} ${verb} (${entry.protocolNumber})`
    : `${subject} ${verb}`;
}
