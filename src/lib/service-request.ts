import "server-only";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import type { Act } from "@/core/acts/catalog.ts";
import {
  generateAccessKey,
  hashAccessKey,
  verifyAccessKey,
} from "@/core/request/access-key.ts";
import {
  isServiceRequestStatus,
  KIND_PREFIXES,
  LIVE_APPOINTMENT_STATUSES,
  type RequestKind,
  type ServiceRequestStatus,
  TERMINAL_SERVICE_REQUEST_STATUSES,
  TERMINAL_STATUSES,
} from "@/core/request/kinds.ts";
import { formatProtocolNumber } from "@/core/request/protocol.ts";
import type { IsoDate } from "@/core/scheduling/calendar.ts";
import type { Occupancy } from "@/core/scheduling/slots.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { user } from "@/db/auth-schema.ts";
import { isPostgresError, UNIQUE_VIOLATION } from "@/db/errors.ts";
import { db } from "@/db/index.ts";
import {
  auditLog,
  serviceRequestAttachments,
  serviceRequestRequirements,
  serviceRequests,
} from "@/db/schema.ts";
import { recordAudit } from "./audit.ts";
import type { StoredAttachment } from "./uploads.ts";

export interface NewServiceRequest {
  applicantName: string;
  contact: string;
  cpf?: string;
  description?: string;
  purpose?: string;
  parameterValue?: string;
  accessKeyHash: string;
  /** Parsed by `serviceRequestDetailsSchema`. Absent files as `{}` (online). */
  details?: unknown;
}

/**
 * A record of any channel. What is absent is absent on purpose: an appointment
 * has no act, an anonymous manifestation has no name and no key. The core
 * decides what each kind requires before anything reaches here.
 */
export interface NewRecord {
  applicantName?: string;
  contact?: string;
  cpf?: string;
  description?: string;
  purpose?: string;
  parameterValue?: string;
  accessKeyHash?: string;
  actId?: string;
  attribution?: string;
  /** Already parsed by the core's schema for the kind. */
  details?: unknown;
  status?: string;
}

const MAX_ATTEMPTS = 5;

async function nextSequence(
  tenantSlug: string,
  kind: RequestKind,
  year: number,
): Promise<number> {
  const [last] = await db
    .select({ sequence: serviceRequests.protocolSequence })
    .from(serviceRequests)
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.kind, kind),
        eq(serviceRequests.protocolYear, year),
      ),
    )
    .orderBy(desc(serviceRequests.protocolSequence))
    .limit(1);
  return (last?.sequence ?? 0) + 1;
}

/**
 * Files a record of any channel and hands back the protocol number.
 *
 * The number is read and then written, which two citizens can do at the same
 * time. The unique index on (office, kind, year, sequence) is what settles it:
 * the loser gets a unique violation and asks for the next number, instead of
 * two people walking away with the same protocol.
 */
export async function createRecord(
  tenant: Tenant,
  kind: RequestKind,
  input: NewRecord,
  attachments: StoredAttachment[] = [],
): Promise<{ id: string; protocolNumber: string }> {
  const year = new Date().getFullYear();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const sequence = await nextSequence(tenant.slug, kind, year);
    const protocolNumber = formatProtocolNumber(
      KIND_PREFIXES[kind],
      year,
      sequence,
    );

    try {
      const [created] = await db
        .insert(serviceRequests)
        .values({
          tenantSlug: tenant.slug,
          kind,
          protocolYear: year,
          protocolSequence: sequence,
          protocolNumber,
          actId: input.actId ?? null,
          attribution: input.attribution ?? null,
          applicantName: input.applicantName ?? null,
          contact: input.contact ?? null,
          cpf: input.cpf ?? null,
          description: input.description ?? null,
          purpose: input.purpose ?? null,
          parameterValue: input.parameterValue ?? null,
          accessKeyHash: input.accessKeyHash ?? null,
          details: input.details ?? {},
          ...(input.status ? { status: input.status } : {}),
        })
        .returning({ id: serviceRequests.id });

      if (attachments.length > 0) {
        await db.insert(serviceRequestAttachments).values(
          attachments.map((a) => ({
            tenantSlug: tenant.slug,
            requestId: created.id,
            kind: "citizen",
            storedName: a.storedName,
            displayName: a.displayName,
            path: a.path,
            mimeType: a.mimeType,
            sizeBytes: a.sizeBytes,
          })),
        );
      }

      await recordAudit({
        tenantSlug: tenant.slug,
        actorId: null, // filed by the citizen, who has no account by design
        action: `${kind}.create`,
        targetType: kind,
        targetId: protocolNumber,
      });

      return { id: created.id, protocolNumber };
    } catch (error) {
      if (!isPostgresError(error, UNIQUE_VIOLATION)) throw error;
      if (attempt === MAX_ATTEMPTS) throw error;
    }
  }

  throw new Error("Nao foi possivel gerar o protocolo do registro.");
}

/**
 * How many appointments already hold each band, for every day in the range.
 * Counted from the records themselves: a band is not a row to be reserved, it
 * is how many people already asked for that hour.
 */
export async function appointmentOccupancy(
  tenantSlug: string,
  from: IsoDate,
  to: IsoDate,
): Promise<Map<IsoDate, Occupancy>> {
  const day = sql<string>`${serviceRequests.details} ->> 'date'`;
  const hour = sql<number>`(${serviceRequests.details} ->> 'slotHour')::int`;

  const rows = await db
    .select({ day, hour, taken: sql<number>`count(*)::int` })
    .from(serviceRequests)
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.kind, "appointment"),
        inArray(serviceRequests.status, [...LIVE_APPOINTMENT_STATUSES]),
        sql`${serviceRequests.details} ->> 'date' between ${from} and ${to}`,
      ),
    )
    .groupBy(day, hour);

  const occupancy = new Map<IsoDate, Occupancy>();
  for (const row of rows) {
    const bands = occupancy.get(row.day) ?? {};
    bands[row.hour] = (bands[row.hour] ?? 0) + Number(row.taken);
    occupancy.set(row.day, bands);
  }
  return occupancy;
}

/**
 * Sends the office's answer to a record's citizen — the same two columns
 * (`officeReply`/`officeRepliedAt`) the protocol consult and the registration
 * lookup already read for `data-rights` and `ombudsman`. Any draft in
 * `details.draftReply` is cleared: once the real answer is sent, keeping the
 * draft around would be a second, stale copy of the same text.
 */
export async function respondToRecord(
  tenantSlug: string,
  id: string,
  kind: RequestKind,
  reply: string,
  status: string,
  actorId: string,
): Promise<void> {
  await db
    .update(serviceRequests)
    .set({
      officeReply: reply,
      officeRepliedAt: new Date(),
      status,
      // The Postgres jsonb "remove key" operator: no need to read the row
      // back first just to drop one field and write the rest unchanged.
      details: sql`${serviceRequests.details} - 'draftReply'`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.id, id),
      ),
    );
  await recordAudit({
    tenantSlug,
    actorId,
    action: `${kind}.respond`,
    targetType: kind,
    targetId: id,
  });
}

/**
 * Moves a record of any kind to a new status — confirm, cancel or mark an
 * appointment attended. Unlike `updateRequestStatus`, there is no closed list
 * to validate against here: each caller (one Server Action per button, same
 * pattern as `/admin/pedidos`) already only ever passes a status that action
 * means to set.
 */
export async function updateRecordStatus(
  tenantSlug: string,
  id: string,
  kind: RequestKind,
  status: string,
  action: string,
  actorId: string,
): Promise<void> {
  await db
    .update(serviceRequests)
    .set({ status, updatedAt: new Date() })
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.id, id),
      ),
    );
  await recordAudit({
    tenantSlug,
    actorId,
    action,
    targetType: kind,
    targetId: id,
  });
}

/**
 * The office proposing a different band than the one asked for. Merges the
 * proposal into `details` (the date and band originally asked for stay put)
 * and moves the status to `"proposed"` in the same write — the citizen's own
 * consult (`acceptProposedSlot`) is what turns the proposal into the
 * appointment.
 */
export async function proposeAppointmentSlot(
  tenantSlug: string,
  id: string,
  date: string,
  slotHour: number,
  actorId: string,
): Promise<void> {
  const patch = JSON.stringify({
    proposedDate: date,
    proposedSlotHour: slotHour,
    proposedAt: new Date().toISOString(),
  });
  await db
    .update(serviceRequests)
    .set({
      status: "proposed",
      details: sql`${serviceRequests.details} || ${patch}::jsonb`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.id, id),
      ),
    );
  await recordAudit({
    tenantSlug,
    actorId,
    action: "appointment.propose",
    targetType: "appointment",
    targetId: id,
  });
}

/**
 * Saves the office's answer in progress, without sending anything. Merges
 * one key into `details` (the jsonb "concatenate" operator), leaving the
 * kind's own fields (the right chosen, the manifestation type) untouched.
 */
export async function saveDraftReply(
  tenantSlug: string,
  id: string,
  kind: RequestKind,
  draftReply: string,
  actorId: string,
): Promise<void> {
  await db
    .update(serviceRequests)
    .set({
      details: sql`${serviceRequests.details} || ${JSON.stringify({ draftReply })}::jsonb`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.id, id),
      ),
    );
  await recordAudit({
    tenantSlug,
    actorId,
    action: `${kind}.draft`,
    targetType: kind,
    targetId: id,
  });
}

/**
 * The ombudsman-only note for a manifestation with no contact to answer to.
 * Never sent anywhere, never read by the citizen's consult — see
 * `ombudsmanDetailsSchema.internalNote`.
 */
export async function saveInternalNote(
  tenantSlug: string,
  id: string,
  note: string,
  actorId: string,
): Promise<void> {
  await db
    .update(serviceRequests)
    .set({
      details: sql`${serviceRequests.details} || ${JSON.stringify({ internalNote: note })}::jsonb`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.id, id),
      ),
    );
  await recordAudit({
    tenantSlug,
    actorId,
    action: "ombudsman.internal-note",
    targetType: "ombudsman",
    targetId: id,
  });
}

/** Replaces the kind specific fields of a record, already parsed by the core. */
export async function updateDetails(
  tenantSlug: string,
  id: string,
  details: unknown,
  status?: string,
): Promise<void> {
  await db
    .update(serviceRequests)
    .set({
      details,
      ...(status ? { status } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.id, id),
      ),
    );
}

/** Files a service request: the record whose kind carries an act. */
export async function createServiceRequest(
  tenant: Tenant,
  act: Act,
  input: NewServiceRequest,
  attachments: StoredAttachment[] = [],
): Promise<{ id: string; protocolNumber: string }> {
  return createRecord(
    tenant,
    "service-request",
    { ...input, actId: act.id, attribution: act.attribution },
    attachments,
  );
}

/**
 * Every service request the office holds, newest first — the admin queue.
 * Scoped to `kind = "service-request"`: the other three channels have their
 * own future screens and are never mixed into this one.
 */
export async function listServiceRequests(
  tenantSlug: string,
  filters: { status?: string; attribution?: string; search?: string } = {},
) {
  const conditions = [
    eq(serviceRequests.tenantSlug, tenantSlug),
    eq(serviceRequests.kind, "service-request"),
  ];
  if (filters.status)
    conditions.push(eq(serviceRequests.status, filters.status));
  if (filters.attribution) {
    conditions.push(eq(serviceRequests.attribution, filters.attribution));
  }
  if (filters.search) {
    const term = `%${filters.search}%`;
    const match = or(
      ilike(serviceRequests.protocolNumber, term),
      ilike(serviceRequests.applicantName, term),
    );
    if (match) conditions.push(match);
  }
  return db
    .select()
    .from(serviceRequests)
    .where(and(...conditions))
    .orderBy(desc(serviceRequests.createdAt));
}

/**
 * Every record of one channel kind, newest first — the admin queue for
 * agenda, ouvidoria and LGPD. Unlike `listServiceRequests`, there is no
 * attribution filter: only `service-request` has an ato to filter by.
 */
export async function listRecordsByKind(
  tenantSlug: string,
  kind: RequestKind,
  filters: { status?: string; search?: string } = {},
) {
  const conditions = [
    eq(serviceRequests.tenantSlug, tenantSlug),
    eq(serviceRequests.kind, kind),
  ];
  if (filters.status)
    conditions.push(eq(serviceRequests.status, filters.status));
  if (filters.search) {
    const term = `%${filters.search}%`;
    const match = or(
      ilike(serviceRequests.protocolNumber, term),
      ilike(serviceRequests.applicantName, term),
    );
    if (match) conditions.push(match);
  }
  return db
    .select()
    .from(serviceRequests)
    .where(and(...conditions))
    .orderBy(desc(serviceRequests.createdAt));
}

/** Records of one channel kind still open — the sidebar badge and the
 * Visão geral counters. */
export async function openCountByKind(
  tenantSlug: string,
  kind: RequestKind,
): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(serviceRequests)
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.kind, kind),
        notInArray(serviceRequests.status, [...TERMINAL_STATUSES[kind]]),
      ),
    );
  return row?.count ?? 0;
}

/** Requests that still need the operator's attention — the sidebar badge. */
export async function openRequestCount(tenantSlug: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(serviceRequests)
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.kind, "service-request"),
        notInArray(serviceRequests.status, [
          ...TERMINAL_SERVICE_REQUEST_STATUSES,
        ]),
      ),
    );
  return row?.count ?? 0;
}

/**
 * Moves a request to a new andamento. The server accepts any of the eight
 * valid values, not only the transition the detail screen suggests — the
 * suggestion is UX curation, not a state machine (see design.md).
 */
export async function updateRequestStatus(
  tenantSlug: string,
  id: string,
  status: ServiceRequestStatus,
  actorId: string,
): Promise<void> {
  if (!isServiceRequestStatus(status)) {
    throw new Error(`Andamento inválido: ${status}`);
  }
  await db
    .update(serviceRequests)
    .set({ status, updatedAt: new Date() })
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.id, id),
      ),
    );
  await recordAudit({
    tenantSlug,
    actorId,
    action: "service-request.status",
    targetType: "service-request",
    targetId: status,
  });
}

/** Every requirement (exigência) raised on a request, oldest first. */
export async function listRequirements(tenantSlug: string, requestId: string) {
  return db
    .select()
    .from(serviceRequestRequirements)
    .where(
      and(
        eq(serviceRequestRequirements.tenantSlug, tenantSlug),
        eq(serviceRequestRequirements.requestId, requestId),
      ),
    )
    .orderBy(asc(serviceRequestRequirements.createdAt));
}

/** The office raises a requirement. It starts, and stays, pending until the citizen answers it. */
export async function registerRequirement(
  tenantSlug: string,
  requestId: string,
  text: string,
  actorId: string,
): Promise<{ id: string }> {
  const [created] = await db
    .insert(serviceRequestRequirements)
    .values({ tenantSlug, requestId, text })
    .returning({ id: serviceRequestRequirements.id });
  await recordAudit({
    tenantSlug,
    actorId,
    action: "service-request.requirement.register",
    targetType: "service-request",
    targetId: requestId,
  });
  return created;
}

/**
 * The citizen answers a pending requirement with one attachment, through the
 * protocol consult. No transaction: the neon-http driver does not support
 * one, the same trade-off `createRecord` already makes for request +
 * attachments.
 */
export async function fulfillRequirement(
  tenantSlug: string,
  requirementId: string,
  attachment: StoredAttachment,
): Promise<void> {
  const [requirement] = await db
    .select({ requestId: serviceRequestRequirements.requestId })
    .from(serviceRequestRequirements)
    .where(
      and(
        eq(serviceRequestRequirements.tenantSlug, tenantSlug),
        eq(serviceRequestRequirements.id, requirementId),
        eq(serviceRequestRequirements.status, "pending"),
      ),
    )
    .limit(1);
  if (!requirement) return;

  const [stored] = await db
    .insert(serviceRequestAttachments)
    .values({
      tenantSlug,
      requestId: requirement.requestId,
      kind: "citizen",
      storedName: attachment.storedName,
      displayName: attachment.displayName,
      path: attachment.path,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
    })
    .returning({ id: serviceRequestAttachments.id });

  await db
    .update(serviceRequestRequirements)
    .set({
      status: "fulfilled",
      fulfilledAt: new Date(),
      resolutionAttachmentId: stored.id,
    })
    .where(eq(serviceRequestRequirements.id, requirementId));

  await recordAudit({
    tenantSlug,
    actorId: null, // the citizen has no account
    action: "service-request.requirement.fulfill",
    targetType: "service-request",
    targetId: requirement.requestId,
  });
}

/** The office records what the request is worth. Corrects freely once set. */
export async function setRequestAmount(
  tenantSlug: string,
  id: string,
  amountCents: number,
  actorId: string,
): Promise<void> {
  await db
    .update(serviceRequests)
    .set({ amountCents, updatedAt: new Date() })
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.id, id),
      ),
    );
  await recordAudit({
    tenantSlug,
    actorId,
    action: "service-request.amount",
    targetType: "service-request",
    targetId: id,
  });
}

/**
 * Generates a new access key and overwrites the stored hash. The old key
 * stops matching the moment this returns — there is nothing else to revoke.
 * The plaintext is returned once, for the caller's response only; it is
 * never read back from the database, same discipline as the original key.
 */
export async function reissueAccessKey(
  tenantSlug: string,
  id: string,
  actorId: string,
): Promise<string> {
  const key = generateAccessKey();
  await db
    .update(serviceRequests)
    .set({ accessKeyHash: hashAccessKey(key), updatedAt: new Date() })
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.id, id),
      ),
    );
  await recordAudit({
    tenantSlug,
    actorId,
    action: "service-request.key-reissue",
    targetType: "service-request",
    targetId: id,
  });
  return key;
}

/**
 * Removes a request and, by cascade, its attachments and requirements.
 * Reserved for a protocol opened by mistake — a real request that should not
 * proceed is moved to "Cancelado" instead, which is why this has no undo.
 *
 * Audited before the delete, not after: once the row is gone this entry is
 * the only place left that says what it was. `audit_log` carries no free-form
 * detail column by design, so the identifying facts travel packed into
 * `targetId` rather than growing the table for one call site.
 */
export async function deleteRequest(
  tenantSlug: string,
  id: string,
  actorId: string,
): Promise<void> {
  const [request] = await db
    .select({
      protocolNumber: serviceRequests.protocolNumber,
      applicantName: serviceRequests.applicantName,
      actId: serviceRequests.actId,
    })
    .from(serviceRequests)
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.id, id),
      ),
    )
    .limit(1);
  if (!request) return;

  await recordAudit({
    tenantSlug,
    actorId,
    action: "service-request.delete",
    targetType: "service-request",
    targetId: [
      request.protocolNumber,
      request.applicantName ?? "sem nome",
      request.actId ?? "sem ato",
    ].join(" · "),
  });

  await db
    .delete(serviceRequests)
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.id, id),
      ),
    );
}

/** The request behind a protocol, scoped to the office that served it. */
export async function findByProtocol(
  tenantSlug: string,
  protocolNumber: string,
) {
  const [request] = await db
    .select()
    .from(serviceRequests)
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.protocolNumber, protocolNumber),
      ),
    )
    .limit(1);
  return request;
}

/**
 * The request behind a protocol, but only when the key really opens it. One
 * check for every screen that unlocks the citizen's own data: the consult
 * page, the PDF download, the signed form upload.
 */
export async function findByProtocolWithKey(
  tenantSlug: string,
  protocolNumber: string,
  accessKey: string,
) {
  const request = await findByProtocol(tenantSlug, protocolNumber);
  // A record without a key is a record nobody can open: the anonymous
  // manifestation, which has no owner to prove. It answers like a protocol
  // that does not exist, which is what it is to everyone who asks.
  if (
    !request?.accessKeyHash ||
    !verifyAccessKey(accessKey, request.accessKeyHash)
  ) {
    return undefined;
  }
  return request;
}

/** Every file attached to a request, oldest first. */
export async function listAttachments(tenantSlug: string, requestId: string) {
  return db
    .select()
    .from(serviceRequestAttachments)
    .where(
      and(
        eq(serviceRequestAttachments.tenantSlug, tenantSlug),
        eq(serviceRequestAttachments.requestId, requestId),
      ),
    )
    .orderBy(asc(serviceRequestAttachments.createdAt));
}

/** Adds the signed form (or any later file) to a request already filed. */
export async function attachToRequest(
  tenantSlug: string,
  requestId: string,
  attachments: StoredAttachment[],
  kind: string,
): Promise<void> {
  if (attachments.length === 0) return;
  await db.insert(serviceRequestAttachments).values(
    attachments.map((a) => ({
      tenantSlug,
      requestId,
      kind,
      storedName: a.storedName,
      displayName: a.displayName,
      path: a.path,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
    })),
  );
}

export interface RequestHistoryEntry {
  action: string;
  actorName: string | null;
  createdAt: Date;
}

/**
 * The audit trail for one request, newest first. Matched by request id or by
 * protocol number because the two are not written consistently: the row's
 * own creation is audited under the protocol (the only identifier that
 * exists before the row does), and every later write is audited under the
 * id. Reading the history is where both meet, rather than every write site
 * agreeing on one.
 */
export async function listRequestHistory(
  tenantSlug: string,
  requestId: string,
  protocolNumber: string,
): Promise<RequestHistoryEntry[]> {
  return db
    .select({
      action: auditLog.action,
      actorName: user.name,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(user, eq(auditLog.actorId, user.id))
    .where(
      and(
        eq(auditLog.tenantSlug, tenantSlug),
        eq(auditLog.targetType, "service-request"),
        or(
          eq(auditLog.targetId, requestId),
          eq(auditLog.targetId, protocolNumber),
        ),
      ),
    )
    .orderBy(desc(auditLog.createdAt));
}

/**
 * The audit trail for one record of any kind. Generalises
 * `listRequestHistory`, which hardcodes `targetType: "service-request"` —
 * `createRecord` already audits every kind's creation under its own
 * `targetType` (`"appointment"`, `"data-rights"`, `"ombudsman"`), so this is
 * the same join, parameterised.
 */
export async function listRecordHistory(
  tenantSlug: string,
  kind: RequestKind,
  requestId: string,
  protocolNumber: string,
): Promise<RequestHistoryEntry[]> {
  return db
    .select({
      action: auditLog.action,
      actorName: user.name,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(user, eq(auditLog.actorId, user.id))
    .where(
      and(
        eq(auditLog.tenantSlug, tenantSlug),
        eq(auditLog.targetType, kind),
        or(
          eq(auditLog.targetId, requestId),
          eq(auditLog.targetId, protocolNumber),
        ),
      ),
    )
    .orderBy(desc(auditLog.createdAt));
}
