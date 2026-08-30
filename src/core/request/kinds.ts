import { z } from "zod";
import { deadlineSchema } from "./deadline.ts";
import { PROTOCOL_PREFIXES, type ProtocolPrefix } from "./protocol.ts";

/**
 * The four things a citizen can file with the office. They share a protocol,
 * an access key and a consult screen, so they share a record: what differs
 * between them is a handful of fields, kept in `details`, not the nature of
 * the thing.
 */
export const REQUEST_KINDS = [
  "service-request",
  "appointment",
  "data-rights",
  "ombudsman",
] as const;
export const RequestKindSchema = z.enum(REQUEST_KINDS);
export type RequestKind = z.infer<typeof RequestKindSchema>;

export const KIND_PREFIXES: Record<RequestKind, ProtocolPrefix> = {
  "service-request": PROTOCOL_PREFIXES.serviceRequest,
  appointment: PROTOCOL_PREFIXES.appointment,
  "data-rights": PROTOCOL_PREFIXES.dataRights,
  ombudsman: PROTOCOL_PREFIXES.ombudsman,
};

export const KIND_BY_PREFIX: Record<ProtocolPrefix, RequestKind> = {
  REQ: "service-request",
  AGD: "appointment",
  SOL: "data-rights",
  OUV: "ombudsman",
};

/**
 * The eighteen andamentos a service request may be in: the general ones every
 * request passes through plus the registral steps of a title's life, which is
 * the vocabulary the registrar actually works in (prenotação, qualificação,
 * registro, averbação). A closed list, not a database enum: every other
 * kind's vocabulary lives in `STATUS_LABELS` below the same way, so a new
 * value is a code change here, never a migration.
 *
 * The identifiers stay English like the rest of the product, even though the
 * office says them in Portuguese. `service_requests.status` is one column
 * shared by all four kinds, and `new`, `done` and `cancelled` already belong
 * to appointments and the other channels too: adopting the legacy system's
 * Portuguese identifiers for this kind alone would leave `em_qualificacao`
 * and `confirmed` side by side in the same column, forever. The pt→en map for
 * the eventual data migration lives in the change's design.md.
 */
export const SERVICE_REQUEST_STATUSES = [
  "new",
  "in-review",
  "awaiting-payment",
  "paid",
  "filed",
  "pre-noted",
  "in-qualification",
  "with-requirement",
  "awaiting-compliance",
  "processing",
  "registered",
  "annotated",
  "granted",
  "ready-for-pickup",
  "done",
  "rejected",
  "cancelled",
  "archived",
] as const;
export type ServiceRequestStatus = (typeof SERVICE_REQUEST_STATUSES)[number];

/** Andamentos that no longer need the operator's attention. */
export const TERMINAL_SERVICE_REQUEST_STATUSES: readonly ServiceRequestStatus[] =
  ["done", "rejected", "cancelled", "archived"];

/**
 * The phases the queue groups the eighteen into. Eighteen steps do not fit a
 * progress bar, and the citizen does not need "averbado" to know where their
 * request stands. The office does, and the office reads the detail screen.
 */
export const SERVICE_REQUEST_PHASES = [
  { id: "intake", label: "Entrada", statuses: ["new", "filed"] },
  {
    id: "analysis",
    label: "Análise",
    statuses: [
      "in-review",
      "pre-noted",
      "in-qualification",
      "with-requirement",
      "awaiting-compliance",
    ],
  },
  {
    id: "payment",
    label: "Pagamento",
    statuses: ["awaiting-payment", "paid"],
  },
  {
    id: "processing",
    label: "Processamento",
    statuses: ["processing", "registered", "annotated", "granted"],
  },
  { id: "delivery", label: "Entrega", statuses: ["ready-for-pickup"] },
  {
    id: "closed",
    label: "Encerrado",
    statuses: ["done", "rejected", "cancelled", "archived"],
  },
] as const satisfies readonly {
  id: string;
  label: string;
  statuses: readonly ServiceRequestStatus[];
}[];

export type ServiceRequestPhaseId =
  (typeof SERVICE_REQUEST_PHASES)[number]["id"];

/** Which phase an andamento belongs to. Every one belongs to exactly one. */
export function phaseOfStatus(
  status: ServiceRequestStatus,
): ServiceRequestPhaseId {
  for (const phase of SERVICE_REQUEST_PHASES) {
    if ((phase.statuses as readonly string[]).includes(status)) return phase.id;
  }
  // Unreachable while the phases cover the list; the test below proves they do.
  return "intake";
}

export function isOpenServiceRequestStatus(status: string): boolean {
  return !(TERMINAL_SERVICE_REQUEST_STATUSES as readonly string[]).includes(
    status,
  );
}

export function isServiceRequestStatus(
  status: string,
): status is ServiceRequestStatus {
  return (SERVICE_REQUEST_STATUSES as readonly string[]).includes(status);
}

/**
 * The andamentos offered as the next step from each one, curated for the
 * detail screen. This is UX guidance, not a state machine: the andamento of a
 * title does not fit one (a prenotação may go to exigência, an exigência back
 * to qualificação, a concluído may reopen), so the server enforces only that
 * the value is one of the eighteen above and that it is not the current one.
 * A correction outside this table (moving a request back out of "Cancelado",
 * say) is still accepted.
 */
const SUGGESTED_NEXT_STATUSES: Record<
  ServiceRequestStatus,
  readonly ServiceRequestStatus[]
> = {
  new: ["in-review", "filed", "cancelled"],
  "in-review": ["awaiting-payment", "pre-noted", "rejected", "cancelled"],
  "awaiting-payment": ["paid", "cancelled"],
  paid: ["processing", "pre-noted", "done"],
  filed: ["pre-noted", "in-review", "cancelled"],
  "pre-noted": ["in-qualification", "with-requirement", "cancelled"],
  "in-qualification": ["with-requirement", "registered", "rejected"],
  "with-requirement": ["awaiting-compliance", "in-qualification", "cancelled"],
  "awaiting-compliance": ["in-qualification", "with-requirement", "cancelled"],
  processing: ["registered", "granted", "ready-for-pickup"],
  registered: ["annotated", "ready-for-pickup", "done"],
  annotated: ["ready-for-pickup", "done"],
  granted: ["ready-for-pickup", "done"],
  "ready-for-pickup": ["done", "archived"],
  done: ["archived"],
  rejected: ["archived"],
  cancelled: ["in-review", "archived"],
  archived: [],
};

export function suggestedNextStatuses(
  status: ServiceRequestStatus,
): readonly ServiceRequestStatus[] {
  return SUGGESTED_NEXT_STATUSES[status];
}

/**
 * Whether the office may move a request from one andamento to another. Free
 * flow on purpose (see above); the one refusal is moving to the andamento it
 * is already in, which would only write an event carrying no information.
 */
export function isAllowedTransition(
  from: ServiceRequestStatus,
  to: ServiceRequestStatus,
): boolean {
  return from !== to;
}

/**
 * The five andamentos a manifestation may be in. Listed here rather than
 * derived from `STATUS_LABELS.ombudsman` below: that map keeps labels for
 * values nobody writes any more (see `appointment`), so its keys name what the
 * consult can spell, not what the office may set.
 */
export const OMBUDSMAN_STATUSES = [
  "new",
  "in-review",
  "answered",
  "done",
  "archived",
] as const;
export type OmbudsmanStatus = (typeof OMBUDSMAN_STATUSES)[number];

export function isOmbudsmanStatus(status: string): status is OmbudsmanStatus {
  return (OMBUDSMAN_STATUSES as readonly string[]).includes(status);
}

/**
 * The andamentos offered as the next step from each one. Same idea as
 * `SUGGESTED_NEXT_STATUSES`: guidance for the detail screen, not a state
 * machine.
 *
 * `answered` is never suggested and never accepted here. Answering is sending
 * a text to the citizen; setting the andamento without sending anything would
 * leave the consult showing "Respondida" with nothing to read. It is reached
 * only by `respondToRecord`, which writes the reply in the same statement.
 */
const SUGGESTED_NEXT_OMBUDSMAN_STATUSES: Record<
  OmbudsmanStatus,
  readonly OmbudsmanStatus[]
> = {
  new: ["in-review", "done", "archived"],
  "in-review": ["done", "archived"],
  answered: ["done", "archived"],
  done: ["in-review", "archived"],
  archived: ["in-review", "done"],
};

export function suggestedOmbudsmanStatuses(
  status: OmbudsmanStatus,
): readonly OmbudsmanStatus[] {
  return SUGGESTED_NEXT_OMBUDSMAN_STATUSES[status];
}

/**
 * Whether the office may move a manifestation from one andamento to another.
 * Free flow like the request's, minus `answered` (see above); the other
 * refusal is the andamento it is already in, which would write an event
 * carrying no information.
 */
export function isAllowedOmbudsmanTransition(
  from: OmbudsmanStatus,
  to: OmbudsmanStatus,
): boolean {
  return from !== to && to !== "answered";
}

/**
 * The statuses that no longer need the operator's attention, per kind: the
 * same idea as `TERMINAL_SERVICE_REQUEST_STATUSES`, generalised so the
 * sidebar badge and the Visão geral counters can ask it of any of the four
 * kinds the same way.
 */
export const TERMINAL_STATUSES: Record<RequestKind, readonly string[]> = {
  "service-request": TERMINAL_SERVICE_REQUEST_STATUSES,
  appointment: ["done", "cancelled"],
  "data-rights": ["answered", "cancelled"],
  ombudsman: ["answered", "done", "archived"],
};

export function isOpenStatus(kind: RequestKind, status: string): boolean {
  return !TERMINAL_STATUSES[kind].includes(status);
}

/**
 * Status of a record, per kind. Only the first value of each kind is written
 * by the citizen's own screens; the rest are written by the office in the
 * admin panel, and are declared here so the consult can name them today.
 */
const STATUS_LABELS: Record<RequestKind, Record<string, string>> = {
  "service-request": {
    new: "Novo",
    "in-review": "Em análise",
    "awaiting-payment": "Aguardando pagamento",
    paid: "Pago",
    filed: "Protocolado",
    "pre-noted": "Prenotado",
    "in-qualification": "Em qualificação",
    "with-requirement": "Com exigência",
    "awaiting-compliance": "Aguardando exigência",
    processing: "Em processamento",
    registered: "Registrado",
    annotated: "Averbado",
    granted: "Deferido",
    "ready-for-pickup": "Disponível para retirada",
    done: "Concluído",
    rejected: "Indeferido",
    cancelled: "Cancelado",
    archived: "Arquivado",
  },
  // Appointments live in their own table now (see core/scheduling/appointment
  // for the statuses in use). These labels remain only so a dormant AGD row
  // filed before that change still names itself in the audit trail.
  appointment: {
    requested: "Pedido enviado",
    proposed: "Proposto",
    confirmed: "Confirmado",
    done: "Atendido",
    cancelled: "Cancelado",
  },
  "data-rights": {
    new: "Recebido",
    answered: "Respondido",
    cancelled: "Cancelado",
  },
  ombudsman: {
    new: "Recebida",
    "in-review": "Em apuração",
    answered: "Respondida",
    done: "Concluída",
    archived: "Arquivada",
  },
};

/** What the citizen reads. An unknown value never leaks a raw column value. */
export function statusLabel(kind: RequestKind, status: string): string {
  return STATUS_LABELS[kind][status] ?? "Em andamento";
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoInstant = z.iso.datetime();

/**
 * The `details` column, by kind. JSONB is not checked by the database, so
 * this is the only door: every write is parsed on the way in and every read on
 * the way out.
 */
export const SERVICE_REQUEST_CHANNELS = ["online", "counter"] as const;
export type ServiceRequestChannel = (typeof SERVICE_REQUEST_CHANNELS)[number];

export const serviceRequestDetailsSchema = z.object({
  // Absent means "online", the default every citizen-filed request already
  // was before the counter could file one directly.
  channel: z.enum(SERVICE_REQUEST_CHANNELS).optional(),
  // What the citizen agreed to, and when. The proof of consent is the
  // controller's to keep (LGPD art. 8 §2), and a checkbox validated and then
  // thrown away is not proof. Absent on requests filed before this was
  // recorded, and on counter-filed ones, where the consent is on the paper the
  // citizen signs at the desk.
  consents: z.object({ lgpd: isoInstant, truth: isoInstant }).optional(),
  // The term in force for this request, once the office has moved it. Absent
  // means the office never touched it and the term is its default counted
  // from the filing date: see `effectiveDeadline`.
  deadline: deadlineSchema.optional(),
  // The citizen's telephone, when they gave one. Here and not in a column of
  // its own because `service_requests` is shared by the four kinds and only
  // this one asks for a telephone apart from the contact: a nullable column
  // for one kind is a migration the jsonb already covers. Nothing searches by
  // telephone; the day the panel does, it earns its column.
  phone: z.string().optional(),
});
export type ServiceRequestDetails = z.infer<typeof serviceRequestDetailsSchema>;

/**
 * The telephone out of a request's `details`, or "" when there is none: the
 * same shape as `readDeadline`, and the only door to a field the database
 * does not check. Empty rather than undefined because every reader shows it
 * in a form or a line of a document, never branches on it.
 */
export function readPhone(details: unknown): string {
  const value = (details as { phone?: unknown } | null)?.phone;
  return typeof value === "string" ? value : "";
}

export const appointmentDetailsSchema = z.object({
  date: isoDate,
  slotHour: z.number().int().min(0).max(23),
  subject: z.string().optional(),
  // Written by the office when the asked band closed before it was confirmed.
  proposedDate: isoDate.optional(),
  proposedSlotHour: z.number().int().min(0).max(23).optional(),
  proposedAt: isoInstant.optional(),
  acceptedAt: isoInstant.optional(),
});
export type AppointmentDetails = z.infer<typeof appointmentDetailsSchema>;

export const DATA_RIGHTS = [
  "access",
  "rectification",
  "deletion",
  "other",
] as const;
export const DataRightSchema = z.enum(DATA_RIGHTS);
export type DataRight = z.infer<typeof DataRightSchema>;

export const dataRightsDetailsSchema = z.object({
  right: DataRightSchema,
  // The office's answer in progress, never read by the citizen's consult:
  // only `officeReply` is. Cleared once the final answer is sent.
  draftReply: z.string().optional(),
});
export type DataRightsDetails = z.infer<typeof dataRightsDetailsSchema>;

export const MANIFESTATION_TYPES = [
  "praise",
  "complaint",
  "suggestion",
  "report",
] as const;
export const ManifestationTypeSchema = z.enum(MANIFESTATION_TYPES);
export type ManifestationType = z.infer<typeof ManifestationTypeSchema>;

export const ombudsmanDetailsSchema = z.object({
  manifestationType: ManifestationTypeSchema,
  /** Nobody signed it: there is no key and no way to answer. */
  anonymous: z.boolean(),
  /** Signed, but the name does not travel with the case. */
  confidential: z.boolean(),
  // Same as `dataRightsDetailsSchema.draftReply`: office-only, never read by
  // the citizen's consult.
  draftReply: z.string().optional(),
  // Only ever offered when the manifestation has no contact to answer to:
  // never sent anywhere, never read by the citizen's consult.
  internalNote: z.string().optional(),
});
export type OmbudsmanDetails = z.infer<typeof ombudsmanDetailsSchema>;

const DETAILS_SCHEMAS = {
  "service-request": serviceRequestDetailsSchema,
  appointment: appointmentDetailsSchema,
  "data-rights": dataRightsDetailsSchema,
  ombudsman: ombudsmanDetailsSchema,
} as const;

export function parseDetails<K extends RequestKind>(
  kind: K,
  value: unknown,
): z.infer<(typeof DETAILS_SCHEMAS)[K]> {
  return DETAILS_SCHEMAS[kind].parse(value) as z.infer<
    (typeof DETAILS_SCHEMAS)[K]
  >;
}
