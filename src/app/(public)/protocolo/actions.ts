"use server";

import { headers } from "next/headers";
import { ATTRIBUTION_NAMES, getActForTenant } from "@/core/acts/catalog.ts";
import {
  dataRightsDayOfDeadline,
  dataRightsDeadline,
} from "@/core/request/channels.ts";
import {
  dayOfDeadline,
  deadlineClock,
  deadlineDate,
  effectiveDeadline,
  type PauseReason,
  pauseReasons,
  readDeadline,
} from "@/core/request/deadline.ts";
import { looksLikeBot } from "@/core/request/form.ts";
import type { DataRight } from "@/core/request/kinds.ts";
import {
  isOpenServiceRequestStatus,
  isOpenStatus,
  type ManifestationType,
  parseDetails,
  type RequestKind,
  readExemption,
  type ServiceRequestStatus,
  statusLabel,
} from "@/core/request/kinds.ts";
import { formatCents } from "@/core/request/money.ts";
import { type IsoDate, toIsoDate } from "@/core/scheduling/calendar.ts";
import { isSectionEnabled } from "@/core/tenant/gating.ts";
import {
  notifyOfficePaymentReported,
  notifyOfficeRequirementReply,
} from "@/lib/email/service-request.ts";
import { type PixCharge, pixChargeFor } from "@/lib/pix-qr.ts";
import { isPollRateLimited, isRateLimited } from "@/lib/rate-limit.ts";
import {
  attachToRequest,
  findByProtocolWithKey,
  listAttachments,
  listRequirementMessages,
  listRequirements,
  requestOwnAttachments,
  updateRequestStatus,
  writeCitizenMessage,
} from "@/lib/service-request.ts";
import { getTenant, OFFICE_TIME_ZONE, today } from "@/lib/tenant.ts";
import { AttachmentError, collectAttachments } from "@/lib/uploads.ts";

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
  /** Last write to the record. A single mutable column, not a per-event
   * log: good enough as a fallback date for a state with no timestamp of
   * its own (e.g. a rejection), never precise once more than one field has
   * changed since. */
  updatedAt: string;
}

export interface RequirementMessageView {
  id: string;
  author: "citizen" | "staff";
  /** Who to show beside the message: the operator's name, or the applicant's. */
  authorName: string;
  body: string;
  createdAt: string;
  attachments: Array<{ id: string; displayName: string }>;
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
  /** The conversation inside this requirement, oldest first. */
  messages: RequirementMessageView[];
}

export interface DeliveredDocumentView {
  id: string;
  createdAt: string;
  displayName: string;
}

export interface CitizenDocumentView {
  id: string;
  createdAt: string;
  displayName: string;
}

export interface ServiceRequestDetail extends BaseDetail {
  kind: "service-request";
  /** The raw andamento, for the timeline to derive its steps from: distinct
   * from `BaseDetail.status`, the "success"/"error" discriminant. */
  requestStatus: ServiceRequestStatus;
  /** Why the office closed the request without delivering it, present only
   * once `requestStatus` is "cancelled" or "rejected"; absent (not empty)
   * when it was closed before this justification existed. */
  statusReason?: string;
  /** The PDF attached instead of (or alongside) `statusReason`, Indeferido
   * only. Same "most recent wins" reasoning as `statusReason` itself: a
   * request indeferido again after being reopened only shows the current
   * document, never a stack of past ones. */
  rejectionDocumentAttachmentId?: string;
  actName: string;
  attributionName: string;
  hasSignedForm: boolean;
  /** Whether the pedido asked for the gratuidade: only then does the
   * download screen offer the declaração de hipossuficiência alongside the
   * requerimento (Provimento CGJ/TJRN n. 7/2026, Anexo I). */
  hasExemption: boolean;
  signedFormReceivedAt?: string;
  /** The signed form's own attachment id, for the citizen to re-download it
   * from "Seus arquivos": distinct from `hasSignedForm`, which only says
   * whether it arrived. */
  signedFormAttachmentId?: string;
  /** What the office is waiting on, cumprida through this same screen. */
  requirements: RequirementView[];
  /** Files the office attached through DeliverySection, downloadable here. */
  deliveredDocuments: DeliveredDocumentView[];
  /** Files the citizen sent, at filing time and later, downloadable here. */
  citizenDocuments: CitizenDocumentView[];
  amountLabel?: string;
  /** True once the office marked the request "Pago" or moved it past that
   * point: the amount still shows as a receipt, but nothing invites the
   * citizen to pay again. */
  paymentSettled?: boolean;
  pix?: PixCharge;
  /** The most recent comprovante the citizen sent via "Já paguei", if any.
   * Present regardless of the andamento reached afterwards (the screen
   * itself decides what to show, from `requestStatus`/`paymentSettled`). */
  paymentReceipt?: { displayName: string; sentAt: string };
  /**
   * The term in force, absent once the request is closed. `overdue` says the
   * expected date has passed without saying by how much: the count of days
   * late is the office's own reading, and printing it here would invite the
   * very telephone call the term exists to spare.
   */
  deadline?: {
    date: IsoDate;
    dayOfTerm: number;
    days: number;
    overdue: boolean;
    /** Present while the clock is stopped: what the office waits on. */
    paused?: PauseReason[];
  };
  /** The term's own length and date, present even once the request is
   * closed: unlike `deadline` above, this says nothing about whether the
   * clock is still running, only what the term was. */
  deadlineTerm: { date: IsoDate; days: number };
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
  /** The office closed it. Not the same as having answered: a manifestation
   * may be concluded or filed away without a reply, and the timeline must not
   * keep saying it is under investigation while the andamento says otherwise. */
  closed: boolean;
}

/** One consult, three shapes: the citizen types the same protocol and key. */
export type ProtocolDetail =
  | ServiceRequestDetail
  | DataRightsDetail
  | OmbudsmanDetail;

export type LookupState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | ProtocolDetail;

/**
 * The tracking screen's live check: the record's `updatedAt` now, under the
 * same protocol and key the consult took. Null for a pair that opens
 * nothing, which is also what a rate-limited caller gets: the screen stops
 * asking rather than showing an error for a question the person never
 * asked.
 */
export async function protocolVersion(
  protocolNumber: string,
  accessKey: string,
): Promise<string | null> {
  const tenant = await getTenant();
  if (!isSectionEnabled(tenant, "consulta-protocolo")) return null;
  if (await isPollRateLimited(await headers())) return null;
  const record = await findByProtocolWithKey(
    tenant.slug,
    protocolNumber,
    accessKey,
  );
  return record?.updatedAt.toISOString() ?? null;
}

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
      updatedAt: record.updatedAt.toISOString(),
    };

    // Appointments are not consulted here any more: they carry no protocol
    // and no key, and the citizen's own e-mail holds everything the consult
    // used to show. A dormant AGD row from before the change falls through to
    // the same neutral "not found" as any other unknown number.
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
        closed: !isOpenStatus("ombudsman", record.status),
      };
    }

    const act = record.actId
      ? getActForTenant(tenant, record.actId)
      : undefined;
    if (!act) return { status: "error", message: NOT_FOUND };

    const attachments = await listAttachments(tenant.slug, record.id);
    const signedForm = attachments.find((a) => a.kind === "signed-form");
    // The most recent one: a corrected resend (wrong file the first time)
    // must be what the office and the citizen both see, not the first try.
    const paymentReceipt = attachments
      .filter((a) => a.kind === "payment-receipt")
      .at(-1);
    const rejectionDocument = attachments
      .filter((a) => a.kind === "rejection-document")
      .at(-1);
    const requirements = await listRequirements(tenant.slug, record.id);
    // One read per requirement: an office raises a handful on a request, not
    // hundreds, and the alternative is a join that would still fan the rows
    // out per message.
    const conversations = await Promise.all(
      requirements.map((r) => listRequirementMessages(tenant.slug, r.id)),
    );
    // "Paid" itself is not a terminal andamento (the office still moves it
    // on to "done"), so it needs its own check alongside the terminal ones:
    // once paid, nothing should invite the citizen to pay again.
    const paymentSettled =
      record.status === "paid" || !isOpenServiceRequestStatus(record.status);

    const open = isOpenServiceRequestStatus(record.status);
    const term = effectiveDeadline(
      toIsoDate(record.createdAt, OFFICE_TIME_ZONE),
      readDeadline(record.details),
      act.legalDeadlineDays,
      tenant.requestDeadlineDays,
    );
    const dayOfTerm = dayOfDeadline(
      term.startedOn,
      deadlineClock(term, today()),
    );

    return {
      ...base,
      kind: "service-request",
      requestStatus: record.status as ServiceRequestStatus,
      statusReason: record.statusReason ?? undefined,
      rejectionDocumentAttachmentId: rejectionDocument?.id,
      actName: act.name,
      attributionName: ATTRIBUTION_NAMES[act.attribution],
      hasSignedForm: Boolean(signedForm),
      hasExemption: Boolean(readExemption(record.details)),
      signedFormReceivedAt: signedForm?.createdAt.toISOString(),
      signedFormAttachmentId: signedForm?.id,
      amountLabel:
        record.amountCents != null
          ? formatCents(record.amountCents)
          : undefined,
      deadline: open
        ? {
            date: deadlineDate(term.startedOn, term.days),
            dayOfTerm,
            days: term.days,
            overdue: dayOfTerm > term.days,
            paused: term.pausedOn
              ? pauseReasons({
                  status: record.status,
                  amountCents: record.amountCents,
                  pendingRequirements: requirements.filter(
                    (r) => r.status === "pending",
                  ).length,
                })
              : undefined,
          }
        : undefined,
      deadlineTerm: {
        date: deadlineDate(term.startedOn, term.days),
        days: term.days,
      },
      paymentSettled,
      pix:
        record.amountCents != null &&
        !paymentSettled &&
        record.status !== "payment-reported"
          ? await pixChargeFor(
              tenant,
              record.protocolNumber,
              record.amountCents,
            )
          : undefined,
      paymentReceipt: paymentReceipt
        ? {
            displayName: paymentReceipt.displayName,
            sentAt: paymentReceipt.createdAt.toISOString(),
          }
        : undefined,
      // A requirement's form is that requirement's, not a delivery: it belongs
      // in its card and never in "Documentos da serventia".
      deliveredDocuments: requestOwnAttachments(attachments)
        .filter((a) => a.kind === "office")
        .map((a) => ({
          id: a.id,
          createdAt: a.createdAt.toISOString(),
          displayName: a.displayName,
        })),
      citizenDocuments: requestOwnAttachments(attachments)
        .filter((a) => a.kind === "citizen")
        .map((a) => ({
          id: a.id,
          createdAt: a.createdAt.toISOString(),
          displayName: a.displayName,
        })),
      requirements: requirements.map((r, i) => ({
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
        messages: conversations[i].map((m) => ({
          id: m.id,
          author: m.author,
          // The office speaks with the operator's name; the citizen with the
          // name they filed under, which is the one they will recognise.
          authorName:
            m.author === "staff"
              ? (m.authorName ?? "Serventia")
              : (record.applicantName ?? "Você"),
          body: m.body,
          createdAt: m.createdAt.toISOString(),
          attachments: m.attachments.map((a) => ({
            id: a.id,
            displayName: a.displayName,
          })),
        })),
      })),
    };
  } catch (error) {
    console.error("protocolo.lookup", error);
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
    const stored = await collectAttachments(formData, "documento", {
      tenantSlug: tenant.slug,
      limit: 1,
    });
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

export type ReportPaymentState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; displayName: string; sentAt: string };

/**
 * The citizen says "já paguei" and hands over the comprovante: one file,
 * required, gravado as an anexo do pedido (`kind: "payment-receipt"`,
 * distinct from the documents it sends via `attachExtraDocument`) and, in
 * the same call, moves the andamento to "Pagamento informado" so the balcão
 * sees it in the fila. Não confirma o pagamento por conta própria: a
 * conferência é da serventia (ver `updateRequestStatus`).
 */
export async function reportPayment(
  _previous: ReportPaymentState,
  formData: FormData,
): Promise<ReportPaymentState> {
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

  // Only a service request carries a value and a Pix charge to report
  // against; the other three kinds never reach this action from the UI, but
  // the server checks anyway since the key alone would otherwise unlock it.
  const settled =
    request.status === "paid" || !isOpenServiceRequestStatus(request.status);
  if (
    request.kind !== "service-request" ||
    request.amountCents == null ||
    settled
  ) {
    return { status: "error", message: GENERIC_ERROR };
  }

  try {
    const stored = await collectAttachments(formData, "comprovante", {
      tenantSlug: tenant.slug,
      // A fixed, friendly name (not the browser-sent one, same discipline as
      // every other upload here): this is the one displayName the citizen's
      // own screen echoes back, so it reads as a label, not a slug.
      kind: "Comprovante de pagamento",
      limit: 1,
    });
    if (stored.length === 0) {
      return {
        status: "error",
        message: "Escolha o comprovante para enviar.",
      };
    }
    const [inserted] = await attachToRequest(
      tenant.slug,
      request.id,
      stored,
      "payment-receipt",
    );
    // Já em "Pagamento informado" (reenvio de comprovante): só o arquivo
    // muda, o andamento fica onde está.
    if (request.status !== "payment-reported") {
      await updateRequestStatus(
        tenant.slug,
        request.id,
        "payment-reported",
        null,
      );
    }
    // Todo envio avisa a serventia, reenvio incluso: um comprovante ilegível
    // ou trocado só se descobre com outro no lugar, e é exatamente o reenvio
    // que traz essa notícia.
    notifyOfficePaymentReported({
      tenant,
      protocolNumber: request.protocolNumber,
      applicantName: request.applicantName,
      amountCents: request.amountCents,
    });
    return {
      status: "success",
      displayName: inserted.displayName,
      sentAt: inserted.createdAt.toISOString(),
    };
  } catch (error) {
    if (error instanceof AttachmentError) {
      return { status: "error", message: error.message };
    }
    console.error("protocolo.report-payment", error);
    return { status: "error", message: GENERIC_ERROR };
  }
}

export type FulfillRequirementState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

/**
 * The citizen answers a pending requirement with one file, through the
 * consult they already have: no e-mail, no phone, same protocol and key as
 * everything else on this screen.
 */
/**
 * The citizen writes into a requirement's conversation, with up to three files
 * riding along. It does not close the requirement: the office decides whether
 * what arrived answers what was asked, and says so from the panel.
 */
export async function writeRequirementMessageAction(
  _previous: FulfillRequirementState,
  formData: FormData,
): Promise<FulfillRequirementState> {
  const tenant = await getTenant();
  const protocolNumber = String(formData.get("protocolNumber") ?? "");
  const accessKey = String(formData.get("accessKey") ?? "");
  const requirementId = String(formData.get("requirementId") ?? "");

  // Invisible to a person: a filled honeypot is a script, and it gets the
  // same silent success the public form gives one, never a hint it was seen.
  if (looksLikeBot(formData.get("website"))) return { status: "success" };

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
    // record the citizen does not hold the key to must not let them write into
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

    const body = String(formData.get("mensagem") ?? "").trim();
    // Three, like a chat message: this is a reply, not a filing. Sending a
    // pile of documents is what the request's own upload is for.
    const stored = await collectAttachments(formData, "resposta", {
      tenantSlug: tenant.slug,
      limit: 3,
    });
    if (!body && stored.length === 0) {
      return {
        status: "error",
        message: "Escreva uma mensagem ou anexe um arquivo para enviar.",
      };
    }

    const written = await writeCitizenMessage(
      tenant.slug,
      requirementId,
      body,
      stored,
    );
    if (!written) {
      return {
        status: "error",
        message:
          "Esta exigência não foi encontrada ou já foi cumprida. Atualize a página para ver a situação atual.",
      };
    }
    notifyOfficeRequirementReply({
      tenant,
      protocolNumber: request.protocolNumber,
      applicantName: request.applicantName,
    });
    return { status: "success" };
  } catch (error) {
    if (error instanceof AttachmentError) {
      return { status: "error", message: error.message };
    }
    console.error("protocolo.requirement-message", error);
    return { status: "error", message: GENERIC_ERROR };
  }
}
