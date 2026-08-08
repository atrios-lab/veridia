import { z } from "zod";
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
 * The eight andamentos a service request may be in, in the order the queue's
 * progress bar shows them plus the two off-ramps (Indeferido, Arquivado). A
 * closed list, not a database enum — every other kind's vocabulary lives in
 * `STATUS_LABELS` below the same way, so a new value is a code change here,
 * never a migration.
 */
export const SERVICE_REQUEST_STATUSES = [
  "new",
  "in-review",
  "awaiting-payment",
  "paid",
  "done",
  "rejected",
  "cancelled",
  "archived",
] as const;
export type ServiceRequestStatus = (typeof SERVICE_REQUEST_STATUSES)[number];

/** Andamentos that no longer need the operator's attention. */
export const TERMINAL_SERVICE_REQUEST_STATUSES: readonly ServiceRequestStatus[] =
  ["done", "rejected", "cancelled", "archived"];

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
 * detail screen. This is UX guidance, not a state machine: the server only
 * enforces that the value is one of the eight above, so a correction that
 * falls outside this table (moving a request back out of "Cancelado", say)
 * is still accepted.
 */
const SUGGESTED_NEXT_STATUSES: Record<
  ServiceRequestStatus,
  readonly ServiceRequestStatus[]
> = {
  new: ["in-review", "cancelled"],
  "in-review": ["awaiting-payment", "rejected", "cancelled"],
  "awaiting-payment": ["paid", "cancelled"],
  paid: ["done", "cancelled"],
  done: ["archived"],
  rejected: ["archived"],
  cancelled: ["archived"],
  archived: [],
};

export function suggestedNextStatuses(
  status: ServiceRequestStatus,
): readonly ServiceRequestStatus[] {
  return SUGGESTED_NEXT_STATUSES[status];
}

/**
 * The statuses that no longer need the operator's attention, per kind — the
 * same idea as `TERMINAL_SERVICE_REQUEST_STATUSES`, generalised so the
 * sidebar badge and the Visão geral counters can ask it of any of the four
 * kinds the same way.
 */
export const TERMINAL_STATUSES: Record<RequestKind, readonly string[]> = {
  "service-request": TERMINAL_SERVICE_REQUEST_STATUSES,
  appointment: ["done", "cancelled"],
  "data-rights": ["answered", "cancelled"],
  ombudsman: ["answered", "done"],
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
    done: "Concluído",
    rejected: "Indeferido",
    cancelled: "Cancelado",
    archived: "Arquivado",
  },
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
  },
};

/** What the citizen reads. An unknown value never leaks a raw column value. */
export function statusLabel(kind: RequestKind, status: string): string {
  return STATUS_LABELS[kind][status] ?? "Em andamento";
}

/** Appointment statuses that still hold a band of the office's day. */
export const LIVE_APPOINTMENT_STATUSES = [
  "requested",
  "proposed",
  "confirmed",
] as const;

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
});
export type ServiceRequestDetails = z.infer<typeof serviceRequestDetailsSchema>;

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
  // The office's answer in progress, never read by the citizen's consult —
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
  // Only ever offered when the manifestation has no contact to answer to —
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
