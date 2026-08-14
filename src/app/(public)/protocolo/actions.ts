"use server";

import { headers } from "next/headers";
import { ATTRIBUTION_NAMES, getActForTenant } from "@/core/acts/catalog.ts";
import {
  dataRightsDayOfDeadline,
  dataRightsDeadline,
} from "@/core/request/channels.ts";
import type { DataRight } from "@/core/request/kinds.ts";
import {
  isOpenServiceRequestStatus,
  type ManifestationType,
  parseDetails,
  type RequestKind,
  type ServiceRequestStatus,
  statusLabel,
} from "@/core/request/kinds.ts";
import { formatCents } from "@/core/request/money.ts";
import {
  deriveQuestionThreadStatus,
  type QuestionThreadStatus,
  questionBodySchema,
} from "@/core/request/question.ts";
import { toIsoDate } from "@/core/scheduling/calendar.ts";
import { isSectionEnabled } from "@/core/tenant/gating.ts";
import { type PixCharge, pixChargeFor } from "@/lib/pix-qr.ts";
import { isRateLimited } from "@/lib/rate-limit.ts";
import {
  addCitizenQuestion,
  attachToRequest,
  findByProtocolWithKey,
  fulfillRequirement,
  listAttachments,
  listQuestions,
  listRequirements,
  requestOwnAttachments,
  updateDetails,
} from "@/lib/service-request.ts";
import { getTenant, OFFICE_TIME_ZONE, today } from "@/lib/tenant.ts";
import { AttachmentError, storeAttachments } from "@/lib/uploads.ts";

const NOT_FOUND =
  "Protocolo ou chave de acesso inválidos. Confira os dados e tente de novo.";
const GENERIC_ERROR =
  "Não foi possível consultar agora. Tente novamente em instantes.";

interface BaseDetail {
  status: "success";
  protocolNumber: string;
  /** Carried along, never re-verified: the forms below (PDF, signed form,
   * extra documents) reuse it so the citizen types the key once per visit. */
  accessKey: string;
  statusLabel: string;
  createdAt: string;
}

export interface RequirementView {
  id: string;
  text: string;
  status: "pending" | "fulfilled";
  createdAt: string;
  fulfilledAt?: string;
  resolutionFileName?: string;
  /** Forms the office attached for the citizen to print and present. */
  forms: Array<{ id: string; createdAt: string }>;
}

export interface DeliveredDocumentView {
  id: string;
  createdAt: string;
}

export interface CitizenDocumentView {
  id: string;
  createdAt: string;
  displayName: string;
}

export interface QuestionView {
  id: string;
  authorType: "citizen" | "staff";
  createdAt: string;
  body: string;
}

export interface ServiceRequestDetail extends BaseDetail {
  kind: "service-request";
  /** The raw andamento, for the timeline to derive its steps from — distinct
   * from `BaseDetail.status`, the "success"/"error" discriminant. */
  requestStatus: ServiceRequestStatus;
  actName: string;
  attributionName: string;
  hasSignedForm: boolean;
  signedFormReceivedAt?: string;
  /** What the office is waiting on, cumprida through this same screen. */
  requirements: RequirementView[];
  /** Files the office attached through DeliverySection, downloadable here. */
  deliveredDocuments: DeliveredDocumentView[];
  /** Files the citizen sent — at filing time and later — downloadable here. */
  citizenDocuments: CitizenDocumentView[];
  amountLabel?: string;
  /** True once the office marked the request "Pago" or moved it past that
   * point — the amount still shows as a receipt, but nothing invites the
   * citizen to pay again. */
  paymentSettled?: boolean;
  pix?: PixCharge;
  questions: QuestionView[];
  questionStatus: QuestionThreadStatus;
}

export interface AppointmentDetail extends BaseDetail {
  kind: "appointment";
  date: string;
  slotHour: number;
  subject?: string;
  /** Written by the office when the asked band closed before confirmation. */
  proposedDate?: string;
  proposedSlotHour?: number;
  proposedAt?: string;
  acceptedAt?: string;
}

export interface DataRightsDetail extends BaseDetail {
  kind: "data-rights";
  right: DataRight;
  /** The day the office has to answer by, and which day of the term today is. */
  deadline: string;
  dayOfDeadline: number;
  dpoName: string;
  reply?: string;
  repliedAt?: string;
}

export interface OmbudsmanDetail extends BaseDetail {
  kind: "ombudsman";
  manifestationType: ManifestationType;
  confidential: boolean;
  reply?: string;
  repliedAt?: string;
}

/** One consult, four shapes: the citizen types the same protocol and key. */
export type ProtocolDetail =
  | ServiceRequestDetail
  | AppointmentDetail
  | DataRightsDetail
  | OmbudsmanDetail;

export type LookupState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | ProtocolDetail;

export async function lookupProtocolDetail(
  _previous: LookupState,
  formData: FormData,
): Promise<LookupState> {
  const tenant = await getTenant();
  if (!isSectionEnabled(tenant, "consulta-protocolo")) {
    return { status: "error", message: NOT_FOUND };
  }

  const protocolNumber = String(formData.get("protocolNumber") ?? "").trim();
  const accessKey = String(formData.get("accessKey") ?? "").trim();
  if (!protocolNumber || !accessKey) {
    return {
      status: "error",
      message: "Informe o protocolo e a chave de acesso.",
    };
  }

  if (await isRateLimited(await headers())) {
    return {
      status: "error",
      message: "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.",
    };
  }

  try {
    const record = await findByProtocolWithKey(
      tenant.slug,
      protocolNumber,
      accessKey,
    );
    if (!record) return { status: "error", message: NOT_FOUND };

    const kind = record.kind as RequestKind;
    const base: BaseDetail = {
      status: "success",
      protocolNumber: record.protocolNumber,
      accessKey,
      statusLabel: statusLabel(kind, record.status),
      createdAt: record.createdAt.toISOString(),
    };

    if (kind === "appointment") {
      return { ...base, kind, ...parseDetails("appointment", record.details) };
    }

    if (kind === "data-rights") {
      const { right } = parseDetails("data-rights", record.details);
      const requestedOn = toIsoDate(record.createdAt, OFFICE_TIME_ZONE);
      return {
        ...base,
        kind,
        right,
        deadline: dataRightsDeadline(requestedOn),
        dayOfDeadline: dataRightsDayOfDeadline(requestedOn, today()),
        dpoName: tenant.dpo.name,
        reply: record.officeReply ?? undefined,
        repliedAt: record.officeRepliedAt?.toISOString(),
      };
    }

    if (kind === "ombudsman") {
      const details = parseDetails("ombudsman", record.details);
      return {
        ...base,
        kind,
        manifestationType: details.manifestationType,
        confidential: details.confidential,
        reply: record.officeReply ?? undefined,
        repliedAt: record.officeRepliedAt?.toISOString(),
      };
    }

    const act = record.actId
      ? getActForTenant(tenant, record.actId)
      : undefined;
    if (!act) return { status: "error", message: NOT_FOUND };

    const attachments = await listAttachments(tenant.slug, record.id);
    const signedForm = attachments.find((a) => a.kind === "signed-form");
    const requirements = await listRequirements(tenant.slug, record.id);
    const questions = await listQuestions(tenant.slug, record.id);
    // "Paid" itself is not a terminal andamento (the office still moves it
    // on to "done"), so it needs its own check alongside the terminal ones:
    // once paid, nothing should invite the citizen to pay again.
    const paymentSettled =
      record.status === "paid" || !isOpenServiceRequestStatus(record.status);

    return {
      ...base,
      kind: "service-request",
      requestStatus: record.status as ServiceRequestStatus,
      actName: act.name,
      attributionName: ATTRIBUTION_NAMES[act.attribution],
      hasSignedForm: Boolean(signedForm),
      signedFormReceivedAt: signedForm?.createdAt.toISOString(),
      amountLabel:
        record.amountCents != null
          ? formatCents(record.amountCents)
          : undefined,
      paymentSettled,
      pix:
        record.amountCents != null && !paymentSettled
          ? await pixChargeFor(
              tenant,
              record.protocolNumber,
              record.amountCents,
            )
          : undefined,
      // A requirement's form is that requirement's, not a delivery: it belongs
      // in its card and never in "Documentos da serventia".
      deliveredDocuments: requestOwnAttachments(attachments)
        .filter((a) => a.kind === "office")
        .map((a) => ({ id: a.id, createdAt: a.createdAt.toISOString() })),
      citizenDocuments: requestOwnAttachments(attachments)
        .filter((a) => a.kind === "citizen")
        .map((a) => ({
          id: a.id,
          createdAt: a.createdAt.toISOString(),
          displayName: a.displayName,
        })),
      requirements: requirements.map((r) => ({
        id: r.id,
        text: r.text,
        status: r.status as "pending" | "fulfilled",
        createdAt: r.createdAt.toISOString(),
        fulfilledAt: r.fulfilledAt?.toISOString(),
        resolutionFileName: r.resolutionAttachmentId
          ? attachments.find((a) => a.id === r.resolutionAttachmentId)
              ?.displayName
          : undefined,
        forms: attachments
          .filter((a) => a.requirementId === r.id)
          .map((a) => ({ id: a.id, createdAt: a.createdAt.toISOString() })),
      })),
      questions: questions.map((q) => ({
        id: q.id,
        authorType: q.authorType,
        createdAt: q.createdAt.toISOString(),
        body: q.body,
      })),
      questionStatus: deriveQuestionThreadStatus(questions),
    };
  } catch (error) {
    console.error("protocolo.lookup", error);
    return { status: "error", message: GENERIC_ERROR };
  }
}

export type AcceptProposalState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; date: string; slotHour: number };

/**
 * The citizen accepting the band the office proposed. It is the one write the
 * consult allows: everything else on this screen is the office's to change.
 */
export async function acceptProposedSlot(
  _previous: AcceptProposalState,
  formData: FormData,
): Promise<AcceptProposalState> {
  const tenant = await getTenant();
  const protocolNumber = String(formData.get("protocolNumber") ?? "");
  const accessKey = String(formData.get("accessKey") ?? "");

  const record = await findByProtocolWithKey(
    tenant.slug,
    protocolNumber,
    accessKey,
  );
  if (!record || record.kind !== "appointment") {
    return { status: "error", message: NOT_FOUND };
  }

  if (await isRateLimited(await headers())) {
    return {
      status: "error",
      message: "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.",
    };
  }

  try {
    const details = parseDetails("appointment", record.details);
    if (!details.proposedDate || details.proposedSlotHour === undefined) {
      return {
        status: "error",
        message:
          "Não há mais horário para aceitar. Atualize a página para ver a situação atual.",
      };
    }

    // The proposal becomes the appointment, and the band originally asked for
    // stays in the record: the timeline reads as what happened, not as what
    // ended up true.
    await updateDetails(
      tenant.slug,
      record.id,
      parseDetails("appointment", {
        ...details,
        acceptedAt: new Date().toISOString(),
      }),
      "confirmed",
    );

    return {
      status: "success",
      date: details.proposedDate,
      slotHour: details.proposedSlotHour,
    };
  } catch (error) {
    console.error("protocolo.accept-proposal", error);
    return { status: "error", message: GENERIC_ERROR };
  }
}

export type AttachDocumentState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string; documents: CitizenDocumentView[] };

/**
 * A document the citizen sends after the fact, separate from the signed
 * requerimento: it lands as another "citizen" attachment, the same kind the
 * initial request carries, since it is still the citizen's own file.
 */
export async function attachExtraDocument(
  _previous: AttachDocumentState,
  formData: FormData,
): Promise<AttachDocumentState> {
  const tenant = await getTenant();
  const protocolNumber = String(formData.get("protocolNumber") ?? "");
  const accessKey = String(formData.get("accessKey") ?? "");

  const request = await findByProtocolWithKey(
    tenant.slug,
    protocolNumber,
    accessKey,
  );
  if (!request) return { status: "error", message: NOT_FOUND };

  if (await isRateLimited(await headers())) {
    return {
      status: "error",
      message: "Muitos envios seguidos. Aguarde um minuto e tente de novo.",
    };
  }

  try {
    const files = formData
      .getAll("documento")
      .filter((f): f is File => f instanceof File);
    const stored = await storeAttachments(files);
    if (stored.length === 0) {
      return { status: "error", message: "Escolha um arquivo para enviar." };
    }
    const inserted = await attachToRequest(
      tenant.slug,
      request.id,
      stored,
      "citizen",
    );
    return {
      status: "success",
      message: "Documento recebido.",
      documents: inserted.map((a) => ({
        id: a.id,
        createdAt: a.createdAt.toISOString(),
        displayName: a.displayName,
      })),
    };
  } catch (error) {
    if (error instanceof AttachmentError) {
      return { status: "error", message: error.message };
    }
    console.error("protocolo.attach-extra", error);
    return { status: "error", message: GENERIC_ERROR };
  }
}

export type FulfillRequirementState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

/**
 * The citizen answers a pending requirement with one file, through the
 * consult they already have — no e-mail, no phone, same protocol and key as
 * everything else on this screen.
 */
export async function fulfillRequirementAction(
  _previous: FulfillRequirementState,
  formData: FormData,
): Promise<FulfillRequirementState> {
  const tenant = await getTenant();
  const protocolNumber = String(formData.get("protocolNumber") ?? "");
  const accessKey = String(formData.get("accessKey") ?? "");
  const requirementId = String(formData.get("requirementId") ?? "");

  const request = await findByProtocolWithKey(
    tenant.slug,
    protocolNumber,
    accessKey,
  );
  if (!request) return { status: "error", message: NOT_FOUND };

  if (await isRateLimited(await headers())) {
    return {
      status: "error",
      message: "Muitos envios seguidos. Aguarde um minuto e tente de novo.",
    };
  }

  try {
    // Scoped to this exact request: knowing a requirement id from another
    // record the citizen does not hold the key to must not let them resolve
    // it just by having a valid protocol and key of their own.
    const requirements = await listRequirements(tenant.slug, request.id);
    const requirement = requirements.find(
      (r) => r.id === requirementId && r.status === "pending",
    );
    if (!requirement) {
      return {
        status: "error",
        message:
          "Esta exigência não foi encontrada ou já foi cumprida. Atualize a página para ver a situação atual.",
      };
    }

    const files = formData
      .getAll("resposta")
      .filter((f): f is File => f instanceof File);
    const stored = await storeAttachments(files);
    if (stored.length === 0) {
      return { status: "error", message: "Escolha um arquivo para enviar." };
    }
    await fulfillRequirement(tenant.slug, requirementId, stored[0]);
    return { status: "success" };
  } catch (error) {
    if (error instanceof AttachmentError) {
      return { status: "error", message: error.message };
    }
    console.error("protocolo.fulfill-requirement", error);
    return { status: "error", message: GENERIC_ERROR };
  }
}

export type SubmitQuestionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; question: QuestionView };

/**
 * The citizen posts a question through the same consult they already
 * unlocked — no e-mail, no phone, and no expectation of an immediate answer
 * (US-07): the office replies whenever it gets to it.
 */
export async function submitQuestionAction(
  _previous: SubmitQuestionState,
  formData: FormData,
): Promise<SubmitQuestionState> {
  const tenant = await getTenant();
  if (!isSectionEnabled(tenant, "consulta-protocolo")) {
    return { status: "error", message: NOT_FOUND };
  }

  const protocolNumber = String(formData.get("protocolNumber") ?? "");
  const accessKey = String(formData.get("accessKey") ?? "");

  const request = await findByProtocolWithKey(
    tenant.slug,
    protocolNumber,
    accessKey,
  );
  if (!request || request.kind !== "service-request") {
    return { status: "error", message: NOT_FOUND };
  }

  if (await isRateLimited(await headers())) {
    return {
      status: "error",
      message: "Muitos envios seguidos. Aguarde um minuto e tente de novo.",
    };
  }

  const parsed = questionBodySchema.safeParse(
    String(formData.get("body") ?? ""),
  );
  if (!parsed.success) {
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ?? "Escreva algo antes de enviar.",
    };
  }

  try {
    const inserted = await addCitizenQuestion(
      tenant.slug,
      request.id,
      parsed.data,
    );
    return {
      status: "success",
      question: {
        id: inserted.id,
        authorType: "citizen",
        createdAt: new Date().toISOString(),
        body: parsed.data,
      },
    };
  } catch (error) {
    console.error("protocolo.submit-question", error);
    return { status: "error", message: GENERIC_ERROR };
  }
}
