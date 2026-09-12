import { z } from "zod";
import { MAX_MESSAGE_LENGTH, TEXT_TOO_LONG } from "../chat/message.ts";
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
 * The eleven andamentos a service request may be in. A closed list, not a
 * database enum: every other kind's vocabulary lives in `STATUS_LABELS`
 * below the same way, so a new value is a code change here, never a
 * migration.
 *
 * Trimmed from twenty (change `enxugar-status-pedido`, see its design.md):
 * the nine removed were either never written by anything but the operator's
 * own hand with no rule distinguishing them from a neighbour (`filed`,
 * `in-review`, and the registral steps `pre-noted`/`in-qualification`, plus
 * `registered`/`annotated`/`granted`, all folded into `processing`), or a
 * second name for a status that already existed (`with-requirement` folded
 * into `awaiting-compliance`; `inactive` folded into `archived`).
 *
 * The identifiers stay English like the rest of the product, even though the
 * office says them in Portuguese. `service_requests.status` is one column
 * shared by all four kinds, and `new`, `done` and `cancelled` already belong
 * to appointments and the other channels too: adopting the legacy system's
 * Portuguese identifiers for this kind alone would leave `em_qualificacao`
 * and `confirmed` side by side in the same column, forever.
 */
export const SERVICE_REQUEST_STATUSES = [
  "new",
  "awaiting-payment",
  "payment-reported",
  "paid",
  "awaiting-compliance",
  "processing",
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
 * The phases the queue groups the eleven into. Even eleven do not fit a
 * progress bar, and the citizen does not need "em processamento" to know
 * where their request stands. The office does, and the office reads the
 * detail screen.
 */
export const SERVICE_REQUEST_PHASES = [
  { id: "intake", label: "Entrada", statuses: ["new"] },
  {
    id: "analysis",
    label: "Análise",
    statuses: ["awaiting-compliance"],
  },
  {
    id: "payment",
    label: "Pagamento",
    statuses: ["awaiting-payment", "payment-reported", "paid"],
  },
  {
    id: "processing",
    label: "Processamento",
    statuses: ["processing"],
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
 * title does not fit one (a exigência pode voltar depois de resolvida, um
 * concluído pode reabrir), so the server enforces only that the value is one
 * of the eleven above and that it is not the current one. A correction
 * outside this table (moving a request back out of "Cancelado", say) is
 * still accepted.
 */
const SUGGESTED_NEXT_STATUSES: Record<
  ServiceRequestStatus,
  readonly ServiceRequestStatus[]
> = {
  new: ["processing", "awaiting-payment", "cancelled"],
  "awaiting-payment": ["paid", "cancelled"],
  "payment-reported": ["paid", "awaiting-payment", "cancelled"],
  paid: ["processing", "done"],
  "awaiting-compliance": ["processing", "cancelled"],
  processing: ["ready-for-pickup", "done"],
  "ready-for-pickup": ["done", "archived"],
  done: ["archived"],
  rejected: ["archived"],
  cancelled: ["processing", "archived"],
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
 * The two andamentos that close a request without delivering it: a
 * cancellation without a why is what makes the citizen call the counter to
 * ask, so moving into either one requires a reason.
 */
export function requiresStatusReason(status: ServiceRequestStatus): boolean {
  return status === "cancelled" || status === "rejected";
}

/**
 * The justification the office writes when closing a request without
 * delivering it. Same shape as `requirementTextSchema` (trim, non-empty,
 * capped at `MAX_MESSAGE_LENGTH`) because it is the same kind of writing: a
 * free-text explanation the citizen reads on the protocol consult.
 */
export const statusReasonSchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(
    z
      .string()
      .min(1, "Escreva o motivo.")
      .max(MAX_MESSAGE_LENGTH, TEXT_TOO_LONG),
  );

export interface StatusReasonCheck {
  status: ServiceRequestStatus;
  /** The raw text from the confirmation, untrimmed. */
  reason: string;
  /** Whether a PDF was attached alongside it. */
  hasAttachment: boolean;
}

export type StatusReasonResult =
  | { ok: true; reason: string | null }
  | { ok: false; message: string };

/**
 * Whether a Cancelado/Indeferido confirmation may proceed, and what to write
 * to `status_reason`. A valid text always satisfies it; a PDF stands in for
 * an empty text only for "rejected": "cancelled" keeps requiring the text on
 * its own, exactly as before this stood in for it.
 */
export function validateStatusReason({
  status,
  reason,
  hasAttachment,
}: StatusReasonCheck): StatusReasonResult {
  if (!requiresStatusReason(status)) return { ok: true, reason: null };
  if (reason.trim().length === 0) {
    if (status === "rejected" && hasAttachment) {
      return { ok: true, reason: null };
    }
    return {
      ok: false,
      message:
        status === "rejected"
          ? "Escreva o motivo ou anexe um documento."
          : "Escreva o motivo.",
    };
  }
  const parsed = statusReasonSchema.safeParse(reason);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Escreva o motivo.",
    };
  }
  return { ok: true, reason: parsed.data };
}

/**
 * O andamento que as exigências abertas impõem ao pedido, depois de registrar,
 * cumprir ou excluir uma. Registrar a exigência já é dizer que o pedido está
 * com exigência, e cumprir a última é devolvê-lo ao processamento: deixar
 * isso para um segundo clique é o que fazia a fila mostrar "Em processamento"
 * com exigência aberta, ou "Aguardando exigência" sem nenhuma, quando o
 * operador esquecia de mover na mão.
 *
 * A volta sai só de "Aguardando exigência", o único andamento que a
 * exigência impõe (antes do corte de `enxugar-status-pedido` havia dois,
 * "Com exigência" e "Aguardando exigência"; fundidos num só): um pedido que
 * já seguiu para o processamento não volta pra lá porque a exigência foi
 * fechada depois. `null` quando não há o que mover: já está lá, ou o pedido
 * está encerrado, e uma exigência mexida depois não o reabre sozinha.
 */
export function statusForRequirements(
  from: ServiceRequestStatus,
  pendingRequirements: number,
): ServiceRequestStatus | null {
  if (!isOpenServiceRequestStatus(from)) return null;
  if (pendingRequirements > 0) {
    return from === "awaiting-compliance" ? null : "awaiting-compliance";
  }
  return from === "awaiting-compliance" ? "processing" : null;
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
    "awaiting-payment": "Aguardando pagamento",
    "payment-reported": "Pagamento informado",
    paid: "Pago",
    "awaiting-compliance": "Aguardando exigência",
    processing: "Em processamento",
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

/**
 * Who formalises the declaration of hipossuficiência, Provimento CGJ/TJRN
 * n. 7/2026 art. 4º §2º: the beneficiary themselves, a legal representative
 * acting on their behalf, or someone who signs a rogo because the
 * beneficiary cannot. The wording matches the Anexo I blocos 6 and 7.
 */
export const EXEMPTION_SIGNED_BY = [
  "self",
  "legal-representative",
  "on-behalf",
] as const;
export type ExemptionSignedBy = (typeof EXEMPTION_SIGNED_BY)[number];

/** A person named in the declaration who is not the beneficiary: a legal
 * representative, someone who signs a rogo, or a witness to that signature.
 * Every field but the name is optional because only the name is asked
 * online; the rest fills in whatever the office collects at the counter. */
const exemptionPersonSchema = z.object({
  name: z.string(),
  cpfOrId: z.string().optional(),
  contact: z.string().optional(),
});

const exemptionSignerSchema = exemptionPersonSchema.extend({
  /** "responsável legal", "tutor", "curador"... free text, art. 4º §2º II. */
  capacity: z.string().optional(),
  proofDocument: z.string().optional(),
});

/**
 * One person's declaration, Provimento art. 4º: individual per beneficiary.
 * Only `name` is required; the rest of the Anexo I bloco 2 is optional online
 * and left blank on the printed declaração for the person to fill by hand.
 * `witnesses` is exactly two when present (Anexo I bloco 8, art. 7º III) and
 * only ever comes from the counter: the online form asks who signs a rogo,
 * never who witnesses it (see `actRules`, `SERVICE_REQUEST_CHANNELS`).
 */
const exemptionBeneficiarySchema = z.object({
  name: z.string(),
  cpfOrId: z.string().optional(),
  birthDate: z.string().optional(),
  occupation: z.string().optional(),
  address: z.string().optional(),
  cityState: z.string().optional(),
  zip: z.string().optional(),
  contact: z.string().optional(),
  signedBy: z.enum(EXEMPTION_SIGNED_BY).default("self"),
  signer: exemptionSignerSchema.optional(),
  witnesses: z.tuple([exemptionPersonSchema, exemptionPersonSchema]).optional(),
});
export type ExemptionBeneficiary = z.infer<typeof exemptionBeneficiarySchema>;

/**
 * The outcome the office reaches after the gratuidade is asked for
 * (Provimento art. 11): granted outright, referred to the Juízo Corregedor
 * over a founded doubt, denied, or replaced by parcelamento (the Juízo's own
 * substitute for denial, art. 11 caput). Recording one never moves the
 * andamento nor `amountCents`: the act is practised at once regardless
 * (art. 11 §3º), and charging for it, if it comes to that, is the office's
 * own move.
 */
export const EXEMPTION_DECISION_OUTCOMES = [
  "granted",
  "referred",
  "denied",
  "installments",
] as const;
export type ExemptionDecisionOutcome =
  (typeof EXEMPTION_DECISION_OUTCOMES)[number];

const exemptionDecisionSchema = z.object({
  outcome: z.enum(EXEMPTION_DECISION_OUTCOMES),
  decidedAt: isoInstant,
  decidedBy: z.string(),
});
export type ExemptionDecision = z.infer<typeof exemptionDecisionSchema>;

/**
 * What the site records about the moment the gratuidade's declaração was
 * accepted, beyond `declaredAt`: the address of who accepted it, for the
 * certification stamp the declaração prints (see
 * `src/core/request/declaracao.ts`, `buildStamp`) and for the office to show
 * the FCRCPN when it asks how a pedido reached the serventia. Absent on
 * every counter-filed pedido (the aceite presencial is the signed paper, not
 * a network address) and on any pedido filed before this was recorded: a
 * missing `ip` prints as a blank line, never a guess.
 */
const exemptionAcceptanceSchema = z.object({
  ip: z.string().optional(),
});
export type ExemptionAcceptance = z.infer<typeof exemptionAcceptanceSchema>;

/**
 * `details.exemption`, grown from `{ declaredAt, actId }` (2026-09) to carry
 * everything the Anexo I do Provimento CGJ/TJRN n. 7/2026 asks. Every field
 * past `declaredAt` is optional so a request filed before this grew is still
 * valid: `readExemption` below is what normalises the gap into an empty
 * `beneficiaries` list, not this schema, which stays the honest shape of
 * what may or may not be on disk.
 */
const exemptionSchema = z.object({
  declaredAt: isoInstant,
  // `actId` diz qual ato a isenção pede, e é opcional porque os pedidos
  // feitos antes de a gratuidade virar ato próprio não o têm: ausente
  // significa "não sabemos", nunca um ato no lugar do que falta.
  actId: z.string().optional(),
  certificateType: z
    .enum(["sem-busca", "com-busca", "inteiro-teor"])
    .optional(),
  beneficiaries: z.array(exemptionBeneficiarySchema).optional(),
  decision: exemptionDecisionSchema.optional(),
  acceptance: exemptionAcceptanceSchema.optional(),
});
export type ExemptionDeclaration = Omit<
  z.infer<typeof exemptionSchema>,
  "beneficiaries"
> & { beneficiaries: ExemptionBeneficiary[] };

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
  // Present means the citizen asked for the statutory exemption and signed the
  // declaration that goes with it; `declaredAt` is when. Same discipline as
  // `consents` right above: a declaration validated and thrown away is not
  // proof, and this one authorises a check against a government system.
  //
  // Asked for, never granted: whether the exemption applies is the office's
  // call, after checking, and it stays out of `amountCents` entirely.
  // `actId` diz qual ato a isenção pede, e é opcional porque os pedidos
  // feitos antes de a gratuidade virar ato próprio não o têm: ausente
  // significa "não sabemos", nunca um ato no lugar do que falta.
  exemption: exemptionSchema.optional(),
});
export type ServiceRequestDetails = z.infer<typeof serviceRequestDetailsSchema>;

/**
 * The telephone out of a request's `details`, or "" when there is none: the
 * same shape as `readDeadline`, and the only door to a field the database
 * does not check. Empty rather than undefined because every reader shows it
 * in a form or a line of a document, never branches on it.
 */
/**
 * The exemption a request carries, or undefined when none was asked for. Same
 * door as `readPhone`: the database does not check jsonb, so everything that
 * reads it parses it. `actId` comes back undefined for the requests filed
 * before the gratuidade became an act of its own; `beneficiaries` comes back
 * `[]` for the same reason, so every reader treats "nothing collected" the
 * same way, whether the pedido is old or just never asked for a name.
 */
export function readExemption(
  details: unknown,
): ExemptionDeclaration | undefined {
  const parsed = exemptionSchema.safeParse(
    (details as { exemption?: unknown } | null)?.exemption,
  );
  if (!parsed.success) return undefined;
  return { beneficiaries: [], ...parsed.data };
}

export function readPhone(details: unknown): string {
  const value = (details as { phone?: unknown } | null)?.phone;
  return typeof value === "string" ? value : "";
}

/**
 * The raw channel a request's `details` carries, or undefined for one filed
 * before `channel` existed (which is the site: every online pedido predates
 * this field). Not typed as `ServiceRequestChannel`: the balcão's manual
 * entry writes `"chat"` for a pedido lançado a partir de uma conversa
 * encerrada (`pedidos/novo/actions.ts`), a value `SERVICE_REQUEST_CHANNELS`
 * does not list and `serviceRequestDetailsSchema` never validated on the way
 * in, so a reader that trusted the enum would silently drop it. The
 * certification stamp (`buildStamp`) is this field's one reader today, and
 * it maps whatever string shows up to a label, unknown values included.
 */
export function readChannel(details: unknown): string | undefined {
  const value = (details as { channel?: unknown } | null)?.channel;
  return typeof value === "string" ? value : undefined;
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
