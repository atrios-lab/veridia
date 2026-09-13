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
import { type Act, getActForTenant } from "@/core/acts/catalog.ts";
import { emailsMatch } from "@/core/email/match.ts";
import {
  generateAccessKey,
  hashAccessKey,
  verifyAccessKey,
} from "@/core/request/access-key.ts";
import {
  type Deadline,
  effectiveDeadline,
  pauseReasons,
  readDeadline,
  resumeDeadline,
} from "@/core/request/deadline.ts";
import type { RequestDataEdit } from "@/core/request/edit.ts";
import {
  type ExemptionDecisionOutcome,
  isOpenServiceRequestStatus,
  isServiceRequestStatus,
  KIND_BY_PREFIX,
  KIND_PREFIXES,
  type RequestKind,
  readExemption,
  requiresStatusReason,
  type ServiceRequestStatus,
  statusForRequirements,
  TERMINAL_SERVICE_REQUEST_STATUSES,
  TERMINAL_STATUSES,
} from "@/core/request/kinds.ts";
import {
  formatProtocolNumber,
  type ProtocolPrefix,
} from "@/core/request/protocol.ts";
import type { SearchTerm } from "@/core/request/search.ts";
import { type IsoDate, toIsoDate } from "@/core/scheduling/calendar.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { user } from "@/db/auth-schema.ts";
import {
  FOREIGN_KEY_VIOLATION,
  isPostgresError,
  UNIQUE_VIOLATION,
} from "@/db/errors.ts";
import { type Database, db } from "@/db/index.ts";
import {
  auditLog,
  serviceRequestAttachments,
  serviceRequestRequirementMessages,
  serviceRequestRequirements,
  serviceRequests,
} from "@/db/schema.ts";
import { recordAudit, recordAuditWith } from "./audit.ts";
import { findPermanentBounceWith } from "./email/bounces.ts";
import { OFFICE_TIME_ZONE } from "./office-config.ts";
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
  database: Database,
  tenantSlug: string,
  kind: RequestKind,
  year: number,
): Promise<number> {
  const [last] = await database
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
export async function createRecordWith(
  database: Database,
  tenant: Tenant,
  kind: RequestKind,
  input: NewRecord,
  attachments: StoredAttachment[] = [],
): Promise<{ id: string; protocolNumber: string }> {
  const year = new Date().getFullYear();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const sequence = await nextSequence(database, tenant.slug, kind, year);
    const protocolNumber = formatProtocolNumber(
      KIND_PREFIXES[kind],
      year,
      sequence,
    );

    try {
      const [created] = await database
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
        await database.insert(serviceRequestAttachments).values(
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

      await recordAuditWith(database, {
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

/** The production singleton, for callers that do not test against it. */
export async function createRecord(
  tenant: Tenant,
  kind: RequestKind,
  input: NewRecord,
  attachments: StoredAttachment[] = [],
): Promise<{ id: string; protocolNumber: string }> {
  return createRecordWith(db, tenant, kind, input, attachments);
}

/**
 * Sends the office's answer to a record's citizen: the same two columns
 * (`officeReply`/`officeRepliedAt`) the protocol consult and the registration
 * lookup already read for `data-rights` and `ombudsman`. Any draft in
 * `details.draftReply` is cleared: once the real answer is sent, keeping the
 * draft around would be a second, stale copy of the same text.
 */
export async function respondToRecordWith(
  database: Database,
  tenantSlug: string,
  id: string,
  kind: RequestKind,
  reply: string,
  status: string,
  actorId: string,
): Promise<void> {
  await database
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
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: `${kind}.respond`,
    targetType: kind,
    targetId: id,
  });
}

/** The production singleton, for callers that do not test against it. */
export async function respondToRecord(
  tenantSlug: string,
  id: string,
  kind: RequestKind,
  reply: string,
  status: string,
  actorId: string,
): Promise<void> {
  return respondToRecordWith(db, tenantSlug, id, kind, reply, status, actorId);
}

/**
 * Moves a record of any kind to a new status: confirm, cancel or mark an
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
 * Saves the office's answer in progress, without sending anything. Merges
 * one key into `details` (the jsonb "concatenate" operator), leaving the
 * kind's own fields (the right chosen, the manifestation type) untouched.
 */
export async function saveDraftReplyWith(
  database: Database,
  tenantSlug: string,
  id: string,
  kind: RequestKind,
  draftReply: string,
  actorId: string,
): Promise<void> {
  await database
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
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: `${kind}.draft`,
    targetType: kind,
    targetId: id,
  });
}

/** The production singleton, for callers that do not test against it. */
export async function saveDraftReply(
  tenantSlug: string,
  id: string,
  kind: RequestKind,
  draftReply: string,
  actorId: string,
): Promise<void> {
  return saveDraftReplyWith(db, tenantSlug, id, kind, draftReply, actorId);
}

/**
 * The ombudsman-only note for a manifestation with no contact to answer to.
 * Never sent anywhere, never read by the citizen's consult: see
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

/**
 * The protocol of an open request the citizen already filed for this act, if
 * any. The CPF identifies the person when given, but it is optional on the
 * form; the e-mail is not, so it is what a CPF-less citizen is matched by
 * instead: dropping to nothing here would let exactly the CPF-less case
 * through unchecked. Checked before any attachment is stored, same reasoning
 * as the other pre-filing refusals in `submitServiceRequest`: a duplicate
 * found after upload would leave the files orphaned in the blob store.
 */
export async function findOpenServiceRequestDuplicateWith(
  database: Database,
  tenantSlug: string,
  actId: string,
  identity: { cpf?: string; email: string },
): Promise<string | undefined> {
  const sameCitizen = identity.cpf
    ? or(
        eq(serviceRequests.cpf, identity.cpf),
        eq(serviceRequests.contact, identity.email),
      )
    : eq(serviceRequests.contact, identity.email);
  const [request] = await database
    .select({
      protocolNumber: serviceRequests.protocolNumber,
      status: serviceRequests.status,
    })
    .from(serviceRequests)
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.kind, "service-request"),
        eq(serviceRequests.actId, actId),
        sameCitizen,
      ),
    )
    .orderBy(desc(serviceRequests.createdAt))
    .limit(1);
  if (!request || !isOpenServiceRequestStatus(request.status)) return undefined;
  return request.protocolNumber;
}

/** The production singleton, for callers that do not test against it. */
export async function findOpenServiceRequestDuplicate(
  tenantSlug: string,
  actId: string,
  identity: { cpf?: string; email: string },
): Promise<string | undefined> {
  return findOpenServiceRequestDuplicateWith(db, tenantSlug, actId, identity);
}

/** Files a service request: the record whose kind carries an act. */
export async function createServiceRequestWith(
  database: Database,
  tenant: Tenant,
  act: Act,
  input: NewServiceRequest,
  attachments: StoredAttachment[] = [],
): Promise<{ id: string; protocolNumber: string }> {
  return createRecordWith(
    database,
    tenant,
    "service-request",
    { ...input, actId: act.id, attribution: act.attribution },
    attachments,
  );
}

/** The production singleton, for callers that do not test against it. */
export async function createServiceRequest(
  tenant: Tenant,
  act: Act,
  input: NewServiceRequest,
  attachments: StoredAttachment[] = [],
): Promise<{ id: string; protocolNumber: string }> {
  return createServiceRequestWith(db, tenant, act, input, attachments);
}

/**
 * Every service request the office holds, newest first: the admin queue.
 * Scoped to `kind = "service-request"`: the other three channels have their
 * own future screens and are never mixed into this one.
 */
export interface QueueFilters {
  /** The andamentos of one tab of the queue; every andamento when absent. */
  statuses?: readonly string[];
  attribution?: string;
  search?: string;
}

function queueConditions(tenantSlug: string, filters: QueueFilters) {
  const conditions = [
    eq(serviceRequests.tenantSlug, tenantSlug),
    eq(serviceRequests.kind, "service-request"),
  ];
  if (filters.statuses) {
    conditions.push(inArray(serviceRequests.status, [...filters.statuses]));
  }
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
  return and(...conditions);
}

export async function listServiceRequests(
  tenantSlug: string,
  filters: QueueFilters & { limit?: number; offset?: number } = {},
) {
  // Newest first is the order the Finalizados tab reads in and pages by, so
  // `limit`/`offset` are only meaningful there. An open tab reorders by term
  // in the page (the term is computed, not stored), so it takes the whole tab.
  let query = db
    .select()
    .from(serviceRequests)
    .where(queueConditions(tenantSlug, filters))
    .orderBy(desc(serviceRequests.createdAt))
    .$dynamic();
  if (filters.limit !== undefined) query = query.limit(filters.limit);
  if (filters.offset !== undefined) query = query.offset(filters.offset);
  return query;
}

/** How many rows `listServiceRequests` would return for the same filters,
 * for the queue's "Exibindo X a Y de Z" and page count. */
export async function countServiceRequests(
  tenantSlug: string,
  filters: QueueFilters = {},
): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(serviceRequests)
    .where(queueConditions(tenantSlug, filters));
  return row?.count ?? 0;
}

/**
 * Every andamento with how many requests sit in it: the counters on the
 * queue's tabs. One GROUP BY rather than one count per tab, and deliberately
 * blind to attribution and search: the counter says how big the tab is,
 * which is what tells the operator where to go next; the footer says how
 * many of those the filter kept.
 */
export async function countByStatus(
  tenantSlug: string,
): Promise<Record<string, number>> {
  const rows = await db
    .select({
      status: serviceRequests.status,
      count: sql<number>`count(*)::int`,
    })
    .from(serviceRequests)
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.kind, "service-request"),
      ),
    )
    .groupBy(serviceRequests.status);
  return Object.fromEntries(rows.map((row) => [row.status, row.count]));
}

/**
 * Every record of one channel kind, newest first: the admin queue for
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

/** Records of one channel kind still open: the sidebar badge and the
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

export interface SearchResult {
  kind: RequestKind;
  id: string;
  protocolNumber: string;
  applicantName: string | null;
  status: string;
  createdAt: Date;
}

const SEARCH_LIMIT = 8;
const searchColumns = {
  id: serviceRequests.id,
  kind: serviceRequests.kind,
  protocolNumber: serviceRequests.protocolNumber,
  applicantName: serviceRequests.applicantName,
  status: serviceRequests.status,
  createdAt: serviceRequests.createdAt,
};

function toSearchResults(
  rows: { kind: string; [key: string]: unknown }[],
): SearchResult[] {
  return rows.map(
    (row) => ({ ...row, kind: row.kind as RequestKind }) as SearchResult,
  );
}

/**
 * The global search's one query: what `term` classified to decides the
 * comparison, protocol is an equality on the normalized number, CPF an
 * equality ignoring both sides' mask, name an `ilike`. Restricted to `kinds`
 * so a session missing `channels.manage` never sees a LGPD, ouvidoria or
 * agenda hit, whatever it types.
 */
export async function searchRecords(
  tenantSlug: string,
  term: SearchTerm,
  kinds: readonly RequestKind[],
): Promise<SearchResult[]> {
  if (kinds.length === 0) return [];
  const scope = and(
    eq(serviceRequests.tenantSlug, tenantSlug),
    inArray(serviceRequests.kind, kinds),
  );

  if (term.type === "protocol") {
    const kind = KIND_BY_PREFIX[term.parsed.prefix as ProtocolPrefix];
    if (!kind || !kinds.includes(kind)) return [];
    const protocolNumber = formatProtocolNumber(
      term.parsed.prefix as ProtocolPrefix,
      term.parsed.year,
      term.parsed.sequence,
    );
    const rows = await db
      .select(searchColumns)
      .from(serviceRequests)
      .where(and(scope, eq(serviceRequests.protocolNumber, protocolNumber)))
      .limit(SEARCH_LIMIT);
    return toSearchResults(rows);
  }

  if (term.type === "cpf") {
    const rows = await db
      .select(searchColumns)
      .from(serviceRequests)
      .where(
        and(
          scope,
          sql`regexp_replace(${serviceRequests.cpf}, '\\D', '', 'g') = ${term.digits}`,
        ),
      )
      .orderBy(desc(serviceRequests.createdAt))
      .limit(SEARCH_LIMIT);
    return toSearchResults(rows);
  }

  const like = `%${term.raw}%`;
  const rows = await db
    .select(searchColumns)
    .from(serviceRequests)
    .where(
      and(
        scope,
        or(
          ilike(serviceRequests.applicantName, like),
          ilike(serviceRequests.protocolNumber, like),
        ),
      ),
    )
    .orderBy(desc(serviceRequests.createdAt))
    .limit(SEARCH_LIMIT);
  return toSearchResults(rows);
}

/** Requests that still need the operator's attention: the sidebar badge. */
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
 * Moves a request to a new andamento. The server accepts any of the closed
 * list of valid values, not only the transition the detail screen suggests:
 * the suggestion is UX curation, not a state machine (see design.md).
 *
 * The term travels with the andamento because that is when the office knows
 * what it is worth: the request just picked up for analysis is the one whose
 * clock should restart. Written in the same statement as the status, so a
 * request never lands in the new andamento carrying the old term.
 *
 * `actorId` is null for the one andamento the citizen writes themselves
 * (`payment-reported`, from the protocol consult): there is no operator
 * account to blame, the same reasoning `AuditEntry.actorId` already carries
 * for an actor "not authenticated yet".
 *
 * `reason` is why the office closed the request without delivering it,
 * required by the caller (`changeStatus`) for `cancelled`/`rejected` and
 * ignored for every other andamento: it overwrites `status_reason`, it never
 * appends, so only the closing that actually stuck is what the citizen reads.
 */
export async function updateRequestStatusWith(
  database: Database,
  tenantSlug: string,
  id: string,
  status: ServiceRequestStatus,
  actorId: string | null,
  deadline?: Deadline,
  reason?: string,
): Promise<void> {
  if (!isServiceRequestStatus(status)) {
    throw new Error(`Andamento inválido: ${status}`);
  }
  await database
    .update(serviceRequests)
    .set({
      status,
      ...(requiresStatusReason(status) && { statusReason: reason ?? null }),
      // Merged into `details`, never assigned over it: the consents recorded
      // at filing live in the same column.
      ...(deadline && {
        details: sql`${serviceRequests.details} || ${JSON.stringify({ deadline })}::jsonb`,
      }),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.id, id),
      ),
    );
  // Keyed by the request, not by the andamento itself, so the entry shows up
  // in the request's own history: `listRequestHistory` matches on the id or
  // the protocol number. Which andamento it became is on the record; what the
  // trail owes is who moved it, and when.
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "service-request.status",
    targetType: "service-request",
    targetId: id,
  });
  if (deadline) {
    // Keyed by the request, not by the term itself, so the entry shows up in
    // the request's own history: `listRequestHistory` matches on the id or
    // the protocol number. What the term became is on the record, a line
    // above this one; what the trail owes is who moved it, and when.
    await recordAuditWith(database, {
      tenantSlug,
      actorId,
      action: "service-request.deadline",
      targetType: "service-request",
      targetId: id,
    });
  }
}

/** The production singleton, for callers that do not test against it. */
export async function updateRequestStatus(
  tenantSlug: string,
  id: string,
  status: ServiceRequestStatus,
  actorId: string | null,
  deadline?: Deadline,
  reason?: string,
): Promise<void> {
  return updateRequestStatusWith(
    db,
    tenantSlug,
    id,
    status,
    actorId,
    deadline,
    reason,
  );
}

/**
 * Marks several requests archived in one go, for the operator clearing many
 * at once instead of one by one. Not a deletion: the row and its history
 * stay, `archived` just reads as "no longer needs the operator's attention"
 * (see `TERMINAL_SERVICE_REQUEST_STATUSES`). Used to write its own `inactive`
 * status; folded into `archived` by the change `enxugar-status-pedido`,
 * which found no rule anywhere that told the two apart.
 *
 * Every id is checked against the tenant before anything is written, so a
 * stale selection (a protocol moved to another tenant mid-session, say) fails
 * the whole batch instead of silently archiving the rest.
 */
export async function deactivateServiceRequests(
  tenantSlug: string,
  ids: readonly string[],
  actorId: string,
): Promise<void> {
  const owned = await db
    .select({ id: serviceRequests.id })
    .from(serviceRequests)
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        inArray(serviceRequests.id, ids as string[]),
      ),
    );
  if (owned.length !== ids.length) {
    throw new Error(
      "Um ou mais protocolos selecionados não foram encontrados.",
    );
  }
  for (const id of ids) {
    await updateRequestStatus(tenantSlug, id, "archived", actorId);
  }
}

/** Every requirement (exigência) raised on a request, oldest first. */
export async function listRequirementsWith(
  database: Database,
  tenantSlug: string,
  requestId: string,
) {
  return database
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

/** The production singleton, for callers that do not test against it. */
export async function listRequirements(tenantSlug: string, requestId: string) {
  return listRequirementsWith(db, tenantSlug, requestId);
}

/**
 * Bumps the request's `updatedAt` for a write that lands on a child row
 * (requirement, message, attachment). The column is the one version signal
 * the tracking screens poll, so anything the citizen or the operator can
 * see change has to pass through here or through a `set({ updatedAt })` of
 * its own.
 */
async function touchRequest(
  database: Database,
  tenantSlug: string,
  requestId: string,
) {
  await database
    .update(serviceRequests)
    .set({ updatedAt: new Date() })
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.id, requestId),
      ),
    );
}

/**
 * Põe o andamento de acordo com as exigências abertas do pedido (ver
 * `statusForRequirements`). Chamada depois de toda escrita que muda esse
 * número: exigência registrada, cumprida ou excluída. Uma função em vez da
 * regra repetida nas três, como `reconcileDeadlinePause` faz com o prazo.
 */
async function reconcileRequirementStatus(
  database: Database,
  tenantSlug: string,
  requestId: string,
  actorId: string,
): Promise<void> {
  const [request] = await database
    .select({ status: serviceRequests.status })
    .from(serviceRequests)
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.id, requestId),
      ),
    )
    .limit(1);
  if (!request) return;
  const pending = (
    await listRequirementsWith(database, tenantSlug, requestId)
  ).filter((r) => r.status === "pending").length;
  const next = statusForRequirements(
    request.status as ServiceRequestStatus,
    pending,
  );
  if (next) {
    await updateRequestStatusWith(
      database,
      tenantSlug,
      requestId,
      next,
      actorId,
    );
  }
}

/** The office raises a requirement. It starts, and stays, pending until the citizen answers it. */
export async function registerRequirementWith(
  database: Database,
  tenantSlug: string,
  requestId: string,
  text: string,
  actorId: string,
): Promise<{ id: string }> {
  const [created] = await database
    .insert(serviceRequestRequirements)
    .values({ tenantSlug, requestId, text })
    .returning({ id: serviceRequestRequirements.id });
  await touchRequest(database, tenantSlug, requestId);
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "service-request.requirement.register",
    targetType: "service-request",
    targetId: requestId,
  });
  // O andamento acompanha a exigência aqui, e não na action: quem registrar
  // exigência de outro lugar move o pedido do mesmo jeito.
  await reconcileRequirementStatus(database, tenantSlug, requestId, actorId);
  return created;
}

/** The production singleton, for callers that do not test against it. */
export async function registerRequirement(
  tenantSlug: string,
  requestId: string,
  text: string,
  actorId: string,
): Promise<{ id: string }> {
  return registerRequirementWith(db, tenantSlug, requestId, text, actorId);
}

/**
 * The office declares a requirement met. This is the office's call, never the
 * citizen's: what the citizen sends is evidence, and only whoever raised the
 * requirement can say the evidence satisfies it. Sending a file used to mark
 * the requirement fulfilled by itself, which meant a blurry scan closed it as
 * surely as a good one.
 *
 * Closing it also closes the conversation: neither side writes into a
 * requirement that is done.
 */
export async function resolveRequirementWith(
  database: Database,
  tenantSlug: string,
  requirementId: string,
  actorId: string,
): Promise<string | null> {
  const [requirement] = await database
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
  if (!requirement) return null;

  await database
    .update(serviceRequestRequirements)
    .set({ status: "fulfilled", fulfilledAt: new Date() })
    .where(eq(serviceRequestRequirements.id, requirementId));
  await touchRequest(database, tenantSlug, requirement.requestId);

  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "service-request.requirement.fulfill",
    targetType: "service-request",
    targetId: requirement.requestId,
  });
  await reconcileRequirementStatus(
    database,
    tenantSlug,
    requirement.requestId,
    actorId,
  );
  return requirement.requestId;
}

/** The production singleton, for callers that do not test against it. */
export async function resolveRequirement(
  tenantSlug: string,
  requirementId: string,
  actorId: string,
): Promise<string | null> {
  return resolveRequirementWith(db, tenantSlug, requirementId, actorId);
}

/** One message of a requirement's conversation, with whatever came attached. */
export interface RequirementMessage {
  id: string;
  author: "citizen" | "staff";
  authorName: string | null;
  body: string;
  createdAt: Date;
  attachments: {
    id: string;
    displayName: string;
    sizeBytes: number;
  }[];
}

/**
 * The conversation of a requirement, oldest first, with the staff author's
 * name resolved. A message whose operator account was later removed keeps its
 * `author` and loses only the name, which is why `author` is a column of its
 * own (see the schema).
 */
export async function listRequirementMessages(
  tenantSlug: string,
  requirementId: string,
): Promise<RequirementMessage[]> {
  const rows = await db
    .select({
      id: serviceRequestRequirementMessages.id,
      author: serviceRequestRequirementMessages.author,
      body: serviceRequestRequirementMessages.body,
      createdAt: serviceRequestRequirementMessages.createdAt,
      authorName: user.name,
    })
    .from(serviceRequestRequirementMessages)
    .leftJoin(user, eq(serviceRequestRequirementMessages.authorUserId, user.id))
    .where(
      and(
        eq(serviceRequestRequirementMessages.tenantSlug, tenantSlug),
        eq(serviceRequestRequirementMessages.requirementId, requirementId),
      ),
    )
    .orderBy(asc(serviceRequestRequirementMessages.createdAt));
  if (rows.length === 0) return [];

  const files = await db
    .select({
      id: serviceRequestAttachments.id,
      displayName: serviceRequestAttachments.displayName,
      sizeBytes: serviceRequestAttachments.sizeBytes,
      messageId: serviceRequestAttachments.requirementMessageId,
    })
    .from(serviceRequestAttachments)
    .where(
      inArray(
        serviceRequestAttachments.requirementMessageId,
        rows.map((r) => r.id),
      ),
    );

  return rows.map((row) => ({
    id: row.id,
    author: row.author === "staff" ? "staff" : "citizen",
    authorName: row.authorName ?? null,
    body: row.body,
    createdAt: row.createdAt,
    attachments: files
      .filter((f) => f.messageId === row.id)
      .map(({ id, displayName, sizeBytes }) => ({
        id,
        displayName,
        sizeBytes,
      })),
  }));
}

/** A requirement that is still open, with the request it belongs to. */
async function pendingRequirement(tenantSlug: string, requirementId: string) {
  const [row] = await db
    .select({ requestId: serviceRequestRequirements.requestId })
    .from(serviceRequestRequirements)
    .where(
      and(
        eq(serviceRequestRequirements.tenantSlug, tenantSlug),
        eq(serviceRequestRequirements.id, requirementId),
        // A fulfilled requirement's conversation is closed to both sides.
        eq(serviceRequestRequirements.status, "pending"),
      ),
    )
    .limit(1);
  return row;
}

/**
 * The citizen writes into a requirement, through the protocol consult. The
 * files ride along on the message but belong to the request as well
 * (`requestId` filled), so a future purge finds them by walking the request.
 *
 * Returns null when the requirement is not open, which the caller answers the
 * same way it answers a wrong key: without saying which it was.
 */
export async function writeCitizenMessage(
  tenantSlug: string,
  requirementId: string,
  body: string,
  attachments: StoredAttachment[] = [],
): Promise<{ id: string } | null> {
  const requirement = await pendingRequirement(tenantSlug, requirementId);
  if (!requirement) return null;

  const [message] = await db
    .insert(serviceRequestRequirementMessages)
    .values({ tenantSlug, requirementId, author: "citizen", body })
    .returning({ id: serviceRequestRequirementMessages.id });

  if (attachments.length > 0) {
    await db.insert(serviceRequestAttachments).values(
      attachments.map((a) => ({
        tenantSlug,
        requestId: requirement.requestId,
        requirementMessageId: message.id,
        kind: "citizen",
        storedName: a.storedName,
        displayName: a.displayName,
        path: a.path,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
      })),
    );
  }
  await touchRequest(db, tenantSlug, requirement.requestId);
  return message;
}

/**
 * The office answers in the requirement's conversation. Audited, unlike the
 * citizen's message: this is an act of the office on the citizen's record.
 * Returns the request id so the caller can notify the citizen.
 */
export async function writeStaffMessage(
  tenantSlug: string,
  requirementId: string,
  body: string,
  actorId: string,
): Promise<{ requestId: string } | null> {
  const requirement = await pendingRequirement(tenantSlug, requirementId);
  if (!requirement) return null;

  await db.insert(serviceRequestRequirementMessages).values({
    tenantSlug,
    requirementId,
    author: "staff",
    authorUserId: actorId,
    body,
  });
  await touchRequest(db, tenantSlug, requirement.requestId);

  await recordAudit({
    tenantSlug,
    actorId,
    action: "service-request.requirement.reply",
    targetType: "service-request",
    targetId: requirement.requestId,
  });
  return { requestId: requirement.requestId };
}

/** Corrects the wording of a requirement the citizen has not answered yet. */
export async function updateRequirementText(
  tenantSlug: string,
  requirementId: string,
  text: string,
  actorId: string,
): Promise<boolean> {
  const [updated] = await db
    .update(serviceRequestRequirements)
    .set({ text })
    .where(
      and(
        eq(serviceRequestRequirements.tenantSlug, tenantSlug),
        eq(serviceRequestRequirements.id, requirementId),
        // Fulfilled is immutable: it is the record of what was asked and met.
        eq(serviceRequestRequirements.status, "pending"),
      ),
    )
    .returning({ requestId: serviceRequestRequirements.requestId });
  if (!updated) return false;
  await touchRequest(db, tenantSlug, updated.requestId);

  await recordAudit({
    tenantSlug,
    actorId,
    action: "service-request.requirement.edit",
    targetType: "service-request",
    targetId: updated.requestId,
  });
  return true;
}

/**
 * Undoes a requirement raised by mistake. The conversation and every file
 * sent inside it go with it (cascade), so the caller removes the stored bytes
 * afterwards using the paths returned here.
 *
 * `recordAudit` lives in this function, not in the action: this is the only
 * path a requirement leaves by, and check:destructive fails the build for a
 * removal with no trail beside it.
 */
export async function deleteRequirement(
  tenantSlug: string,
  requirementId: string,
  actorId: string,
): Promise<{ requestId: string; paths: string[] } | null> {
  const [requirement] = await db
    .select({
      requestId: serviceRequestRequirements.requestId,
      status: serviceRequestRequirements.status,
    })
    .from(serviceRequestRequirements)
    .where(
      and(
        eq(serviceRequestRequirements.tenantSlug, tenantSlug),
        eq(serviceRequestRequirements.id, requirementId),
      ),
    )
    .limit(1);
  if (!requirement || requirement.status !== "pending") return null;

  // Read the paths before the cascade takes the rows with it.
  const files = await db
    .select({ path: serviceRequestAttachments.path })
    .from(serviceRequestAttachments)
    .where(eq(serviceRequestAttachments.requirementId, requirementId));

  await db
    .delete(serviceRequestRequirements)
    .where(
      and(
        eq(serviceRequestRequirements.tenantSlug, tenantSlug),
        eq(serviceRequestRequirements.id, requirementId),
      ),
    );
  await touchRequest(db, tenantSlug, requirement.requestId);

  await recordAudit({
    tenantSlug,
    actorId,
    action: "service-request.requirement.delete",
    targetType: "service-request",
    targetId: requirement.requestId,
  });
  await reconcileRequirementStatus(
    db,
    tenantSlug,
    requirement.requestId,
    actorId,
  );
  return { requestId: requirement.requestId, paths: files.map((f) => f.path) };
}

/** The office records what the request is worth. Corrects freely once set, or clears it (null). */
export async function setRequestAmountWith(
  database: Database,
  tenantSlug: string,
  id: string,
  amountCents: number | null,
  actorId: string,
): Promise<void> {
  await database
    .update(serviceRequests)
    .set({ amountCents, updatedAt: new Date() })
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.id, id),
      ),
    );
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "service-request.amount",
    targetType: "service-request",
    targetId: id,
  });
}

/** The production singleton, for callers that do not test against it. */
export async function setRequestAmount(
  tenantSlug: string,
  id: string,
  amountCents: number | null,
  actorId: string,
): Promise<void> {
  return setRequestAmountWith(db, tenantSlug, id, amountCents, actorId);
}

/**
 * The outcome the office reaches on a gratuidade already asked for
 * (Provimento CGJ/TJRN n. 7/2026, art. 11): concedida, submetida ao Juízo,
 * indeferida, ou substituída por parcelamento. `outcome: null` removes a
 * decision recorded by mistake. Refuses on a pedido without `exemption`:
 * there is nothing here to decide. Only `details.exemption.decision`
 * changes, never `status` nor `amountCents`, since the act is practised at
 * once regardless of the outcome (art. 11 §3º) and the value stays the
 * operator's own call.
 */
export async function setExemptionDecision(
  tenantSlug: string,
  id: string,
  outcome: ExemptionDecisionOutcome | null,
  actorId: string,
): Promise<void> {
  const stored = await findById(tenantSlug, id);
  if (!stored || !readExemption(stored.details)) {
    throw new Error("Este pedido não pediu gratuidade.");
  }

  await db
    .update(serviceRequests)
    .set({
      details: outcome
        ? sql`jsonb_set(
            ${serviceRequests.details},
            '{exemption,decision}',
            ${JSON.stringify({
              outcome,
              decidedAt: new Date().toISOString(),
              decidedBy: actorId,
            })}::jsonb,
            true
          )`
        : sql`${serviceRequests.details} #- '{exemption,decision}'`,
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
    action: "service-request.exemption-decision",
    targetType: "service-request",
    targetId: id,
  });
}

/**
 * Corrects what the counter typed. `createdAt` is editable on purpose: the
 * office files the walk-in later, and the protocol is worth the moment of the
 * attendance, not the moment someone got to the keyboard.
 *
 * The act and the protocol number are not here and must never be: changing the
 * act changes the attribution and the legal basis of something already
 * protocolled, which is a new request, not an edit.
 */
export async function updateRequestData(
  tenantSlug: string,
  id: string,
  data: RequestDataEdit,
  actorId: string,
): Promise<void> {
  // The telephone has no column of its own: it lives in `details` (see
  // `serviceRequestDetailsSchema`), so it is merged into the jsonb instead of
  // assigned, the way the internal note is.
  const { phone, ...columns } = data;
  await db
    .update(serviceRequests)
    .set({
      ...columns,
      details: sql`${serviceRequests.details} || ${JSON.stringify({ phone })}::jsonb`,
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
    action: "service-request.edit",
    targetType: "service-request",
    targetId: id,
  });
}

/**
 * Generates a new access key and overwrites the stored hash. The old key
 * stops matching the moment this returns: there is nothing else to revoke.
 * The plaintext is returned once, for the caller's response only; it is
 * never read back from the database, same discipline as the original key.
 *
 * `actorId` is null when the citizen is the one recovering their own key
 * from the consult page (`recoverAccessKeyAction`): there is no operator
 * behind that request, the same reasoning `createRecord` already applies to
 * a pedido's own creation. The panel no longer calls this with a real
 * operator id: `reissueKeyAction` was removed with the change that made
 * recovery the citizen's own path.
 */
export async function reissueAccessKeyWith(
  database: Database,
  tenantSlug: string,
  id: string,
  actorId: string | null,
): Promise<string> {
  const key = generateAccessKey();
  await database
    .update(serviceRequests)
    .set({ accessKeyHash: hashAccessKey(key), updatedAt: new Date() })
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.id, id),
      ),
    );
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "service-request.key-reissue",
    targetType: "service-request",
    targetId: id,
  });
  return key;
}

/** The production singleton, for callers that do not test against it. */
export async function reissueAccessKey(
  tenantSlug: string,
  id: string,
  actorId: string | null,
): Promise<string> {
  return reissueAccessKeyWith(db, tenantSlug, id, actorId);
}

/**
 * Decides whether a citizen's "perdi a chave" request earns a new key, and
 * issues it when it does. The caller (recoverAccessKeyAction) answers with
 * the same message either way and sends the e-mail only when `reissued` is
 * true: telling the two outcomes apart on screen would turn the form into a
 * way to test protocol/e-mail pairs one at a time.
 */
export interface AccessKeyRecovery {
  reissued: boolean;
  accessKey?: string;
  contact?: string;
  protocolNumber?: string;
}

export async function recoverAccessKeyWith(
  database: Database,
  tenantSlug: string,
  protocolNumber: string,
  email: string,
): Promise<AccessKeyRecovery> {
  const request = await findByProtocolWith(
    database,
    tenantSlug,
    protocolNumber,
  );
  if (
    !request ||
    request.kind !== "service-request" ||
    !request.contact ||
    !emailsMatch(request.contact, email)
  ) {
    return { reissued: false };
  }

  // Checked before anything is generated: swapping the key for one that
  // cannot be delivered would strand the citizen with neither.
  const bounced = await findPermanentBounceWith(database, request.contact);
  if (bounced) return { reissued: false };

  const accessKey = await reissueAccessKeyWith(
    database,
    tenantSlug,
    request.id,
    // The citizen is the actor here, not an operator: same reasoning
    // createRecord already applies to the pedido's own filing.
    null,
  );
  return {
    reissued: true,
    accessKey,
    contact: request.contact,
    protocolNumber: request.protocolNumber,
  };
}

/**
 * Removes a request and, by cascade, its attachments and requirements.
 * Reserved for a protocol opened by mistake: a real request that should not
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

/** The request by id: for a screen that already knows the id, not the
 * protocol (e.g. a chat conversation's matched or linked request). */
export async function findByIdWith(
  database: Database,
  tenantSlug: string,
  id: string,
) {
  const [request] = await database
    .select()
    .from(serviceRequests)
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.id, id),
      ),
    )
    .limit(1);
  return request;
}

/** The production singleton, for callers that do not test against it. */
export async function findById(tenantSlug: string, id: string) {
  return findByIdWith(db, tenantSlug, id);
}

/** The request behind a protocol, scoped to the office that served it. */
export async function findByProtocolWith(
  database: Database,
  tenantSlug: string,
  protocolNumber: string,
) {
  const [request] = await database
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

/** The production singleton, for callers that do not test against it. */
export async function findByProtocol(
  tenantSlug: string,
  protocolNumber: string,
) {
  return findByProtocolWith(db, tenantSlug, protocolNumber);
}

/**
 * The request behind a protocol, but only when the key really opens it. One
 * check for every screen that unlocks the citizen's own data: the consult
 * page, the PDF download, the signed form upload.
 */
export async function findByProtocolWithKeyWith(
  database: Database,
  tenantSlug: string,
  protocolNumber: string,
  accessKey: string,
) {
  const request = await findByProtocolWith(
    database,
    tenantSlug,
    protocolNumber,
  );
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

/** The production singleton, for callers that do not test against it. */
export async function findByProtocolWithKey(
  tenantSlug: string,
  protocolNumber: string,
  accessKey: string,
) {
  return findByProtocolWithKeyWith(db, tenantSlug, protocolNumber, accessKey);
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

/**
 * What hangs off the request itself. A form the office attached to a
 * requirement is not one of these: it belongs to that requirement, shows up
 * in its card, and must never appear among the request's deliveries. Every
 * list that means "the documents of this request" goes through here, so a new
 * one cannot quietly forget the distinction.
 */
export function requestOwnAttachments<
  T extends {
    requirementId: string | null;
    requirementMessageId?: string | null;
  },
>(attachments: T[]): T[] {
  // Two kinds of file hang off a requirement instead of the request: the form
  // the office attached to it, and whatever rode along a message in its
  // conversation. Neither belongs in the request's own document lists, where
  // they would show up twice and outlive the requirement that gives them
  // meaning.
  return attachments.filter(
    (a) => a.requirementId === null && !a.requirementMessageId,
  );
}

/**
 * One attachment on a request, scoped to tenant + request so an id guessed
 * from another citizen's request can't be pulled through this. Kind-agnostic:
 * both the admin panel and the citizen's own consult use it, each already
 * gated by their own access check before reaching here.
 */
export async function getAttachmentWith(
  database: Database,
  tenantSlug: string,
  requestId: string,
  attachmentId: string,
) {
  const [attachment] = await database
    .select()
    .from(serviceRequestAttachments)
    .where(
      and(
        eq(serviceRequestAttachments.tenantSlug, tenantSlug),
        eq(serviceRequestAttachments.requestId, requestId),
        eq(serviceRequestAttachments.id, attachmentId),
      ),
    )
    .limit(1);
  return attachment;
}

/** The production singleton, for callers that do not test against it. */
export async function getAttachment(
  tenantSlug: string,
  requestId: string,
  attachmentId: string,
) {
  return getAttachmentWith(db, tenantSlug, requestId, attachmentId);
}

export class AttachmentInUseError extends Error {}

/**
 * Removes one attachment a citizen sent by mistake. Returns the deleted row
 * so the caller can also remove the underlying file/blob: scoped to
 * tenant + request, same reasoning as `getAttachment`.
 *
 * A file that answered a requirement is still referenced by that
 * requirement's `resolutionAttachmentId`, so Postgres rejects the delete
 * with a foreign key violation: turned into a message the office can act
 * on, instead of the generic "try again".
 */
export async function deleteAttachment(
  tenantSlug: string,
  requestId: string,
  attachmentId: string,
  actorId: string,
) {
  try {
    const [deleted] = await db
      .delete(serviceRequestAttachments)
      .where(
        and(
          eq(serviceRequestAttachments.tenantSlug, tenantSlug),
          eq(serviceRequestAttachments.requestId, requestId),
          eq(serviceRequestAttachments.id, attachmentId),
        ),
      )
      .returning();
    // Recorded here and not in the actions: this is the one place both the
    // service-request panel and the LGPD panel route through, and the row is
    // gone for good the moment it returns: the citizen's document with it.
    // A caller that forgets the trail is a deletion nobody can account for.
    if (deleted) {
      await touchRequest(db, tenantSlug, requestId);
      await recordAudit({
        tenantSlug,
        actorId,
        action: "service-request.attachment.delete",
        targetType: "attachment",
        targetId: attachmentId,
      });
    }
    return deleted;
  } catch (error) {
    if (isPostgresError(error, FOREIGN_KEY_VIOLATION)) {
      throw new AttachmentInUseError(
        "Este documento respondeu a uma exigência e não pode ser excluído.",
      );
    }
    throw error;
  }
}

/** Adds the signed form (or any later file) to a request already filed. */
export async function attachToRequestWith(
  database: Database,
  tenantSlug: string,
  requestId: string,
  attachments: StoredAttachment[],
  kind: string,
  /** Set only for the form a requirement carries; see `requestOwnAttachments`. */
  requirementId?: string,
) {
  if (attachments.length === 0) return [];
  await touchRequest(database, tenantSlug, requestId);
  return database
    .insert(serviceRequestAttachments)
    .values(
      attachments.map((a) => ({
        tenantSlug,
        requestId,
        kind,
        requirementId,
        storedName: a.storedName,
        displayName: a.displayName,
        path: a.path,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
      })),
    )
    .returning();
}

/** The production singleton, for callers that do not test against it. */
export async function attachToRequest(
  tenantSlug: string,
  requestId: string,
  attachments: StoredAttachment[],
  kind: string,
  requirementId?: string,
) {
  return attachToRequestWith(
    db,
    tenantSlug,
    requestId,
    attachments,
    kind,
    requirementId,
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
 * `listRequestHistory`, which hardcodes `targetType: "service-request"`,
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

/**
 * Writes only the term, leaving the andamento where it is: the office
 * re-reads a prazo it got wrong without inventing a step in the request's
 * life to hang the correction on.
 */
async function writeDeadline(
  database: Database,
  tenantSlug: string,
  id: string,
  deadline: Deadline,
): Promise<void> {
  await database
    .update(serviceRequests)
    .set({
      // Merged into `details`, never assigned over it: the consents recorded
      // at filing live in the same column. The `deadline` key itself is
      // replaced whole, which is what lets a resume drop `pausedOn`.
      details: sql`${serviceRequests.details} || ${JSON.stringify({ deadline })}::jsonb`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.id, id),
      ),
    );
}

export async function updateRequestDeadlineWith(
  database: Database,
  tenantSlug: string,
  id: string,
  actorId: string,
  deadline: Deadline,
): Promise<void> {
  await writeDeadline(database, tenantSlug, id, deadline);
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "service-request.deadline",
    targetType: "service-request",
    targetId: id,
  });
}

/** The production singleton, for callers that do not test against it. */
export async function updateRequestDeadline(
  tenantSlug: string,
  id: string,
  actorId: string,
  deadline: Deadline,
): Promise<void> {
  return updateRequestDeadlineWith(db, tenantSlug, id, actorId, deadline);
}

/**
 * Stops or restarts the request's clock to match what the citizen owes (see
 * `pauseReasons`), and writes nothing when the two already agree. Called
 * after every write that can change a reason: a requirement registered,
 * fulfilled or deleted, a value set or cleared, an andamento moved. One
 * function rather than a rule in each of those five, because five copies of
 * the same rule is how one of them ends up different.
 *
 * `pausedOn` defaults to today; the backfill passes the day the clock should
 * have stopped. Returns what it did, for the caller that wants to say so.
 */
export async function reconcileDeadlinePauseWith(
  database: Database,
  tenant: Tenant,
  requestId: string,
  actorId: string | null,
  today: IsoDate,
  pausedOn: IsoDate = today,
): Promise<"paused" | "resumed" | null> {
  const request = await findByIdWith(database, tenant.slug, requestId);
  if (!request) return null;
  const pendingRequirements = (
    await listRequirementsWith(database, tenant.slug, requestId)
  ).filter((r) => r.status === "pending").length;

  const act = request.actId
    ? getActForTenant(tenant, request.actId)
    : undefined;
  const current = effectiveDeadline(
    toIsoDate(request.createdAt, OFFICE_TIME_ZONE),
    readDeadline(request.details),
    act?.legalDeadlineDays,
    tenant.requestDeadlineDays,
  );
  const owed =
    pauseReasons({
      status: request.status,
      amountCents: request.amountCents,
      pendingRequirements,
    }).length > 0;
  if (owed === Boolean(current.pausedOn)) return null;

  await writeDeadline(
    database,
    tenant.slug,
    requestId,
    owed
      ? { ...current, pausedOn }
      : resumeDeadline(current, today, act?.legalDeadlineDays != null),
  );
  await recordAuditWith(database, {
    tenantSlug: tenant.slug,
    actorId,
    action: owed
      ? "service-request.deadline.pause"
      : "service-request.deadline.resume",
    targetType: "service-request",
    targetId: requestId,
  });
  return owed ? "paused" : "resumed";
}

/** The production singleton, for callers that do not test against it. */
export async function reconcileDeadlinePause(
  tenant: Tenant,
  requestId: string,
  actorId: string | null,
  today: IsoDate,
  pausedOn: IsoDate = today,
): Promise<"paused" | "resumed" | null> {
  return reconcileDeadlinePauseWith(
    db,
    tenant,
    requestId,
    actorId,
    today,
    pausedOn,
  );
}
