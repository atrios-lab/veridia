"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getActForTenant } from "@/core/acts/catalog.ts";
import { can } from "@/core/auth/roles.ts";
import {
  isSignedFormDocument,
  REJECTION_DOCUMENT_MIME_TYPE,
  SIGNED_FORM_NAMES,
} from "@/core/request/attachment.ts";
import {
  type Deadline,
  deadlineDaysSchema,
  effectiveDeadline,
  MAX_DEADLINE_DAYS,
  MIN_DEADLINE_DAYS,
  readDeadline,
} from "@/core/request/deadline.ts";
import {
  deliveryName,
  sanitizeDeliveryName,
} from "@/core/request/delivery-name.ts";
import {
  purposeFor,
  requestDataEditSchema,
  resolveIdentityEdit,
  resolveVariantEdit,
} from "@/core/request/edit.ts";
import { isEmailContact } from "@/core/request/form.ts";
import {
  EXEMPTION_DECISION_OUTCOMES,
  isAllowedTransition,
  isServiceRequestStatus,
  readActVariant,
  readAlternateDocument,
  readExemption,
  requiresStatusReason,
  type ServiceRequestStatus,
  searchAnswerInputSchema,
  statusAfterAmount,
  validateStatusReason,
} from "@/core/request/kinds.ts";
import { parseCentsInput } from "@/core/request/money.ts";
import { requirementTextSchema } from "@/core/request/requirement.ts";
import { readSignedFormCheck } from "@/core/request/signed-form-check.ts";
import { toIsoDate } from "@/core/scheduling/calendar.ts";
import { officialName } from "@/core/tenant/identification.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { db } from "@/db/index.ts";
import { justify } from "@/lib/audit-reason.ts";
import { notifyCitizen, sendAccessKey } from "@/lib/email/service-request.ts";
import {
  AttachmentInUseError,
  answerSearch,
  attachToRequest,
  deleteAttachment,
  deleteRequest,
  deleteRequirement,
  findById,
  listAttachments,
  listRequirements,
  reconcileDeadlinePause,
  registerRequirement,
  reissueAccessKey,
  renameDeliveredAttachment,
  resolveRequirement,
  setExemptionDecision,
  setRequestAmount,
  updateRequestData,
  updateRequestDeadline,
  updateRequestStatus,
  updateRequirementText,
  writeStaffMessage,
} from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
import { CertificatePasswordError } from "@/lib/signature/certificate.ts";
import { requestOrigin, verifyUrlFor } from "@/lib/signature/documents.ts";
import { PdfNotSignableError } from "@/lib/signature/pades.ts";
import { saveSignedFormCheckWith } from "@/lib/signed-form-reading.ts";
import {
  confirmPhysicalSignatureWith,
  fileHasDigitalSignature,
  finishA3DeliveryWith,
  holdForSignatureWith,
  isHeldForSignatureWith,
  prepareA3DeliveryWith,
  recordUnsignedDeliveryWith,
  releaseUnsignedWith,
  SigningError,
  signDeliveredDocumentWith,
} from "@/lib/signing.ts";
import { getTenant, OFFICE_TIME_ZONE, today } from "@/lib/tenant.ts";
import {
  AttachmentError,
  deleteStoredFile,
  storeAttachments,
} from "@/lib/uploads.ts";

export type ActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  // `emailWarning` carries the one thing the operator cannot find out later:
  // that the citizen's address does not take mail. The record was saved
  // either way, so this is not an error, and it is not a badge on the page
  // either: it belongs to the moment someone tried to write.
  | {
      status: "success";
      emailWarning?: string | null;
      /** The file stayed back, to be signed before the citizen sees it. */
      held?: boolean;
    };

const NO_PERMISSION = "Você não tem permissão para alterar este pedido.";
const GENERIC_ERROR =
  "Não foi possível salvar agora. Tente novamente em instantes.";

/** Every action here re-checks on the server: the sidebar hiding the link, and
 * the page 404-ing, are both a courtesy: never the gate. */
async function authorize() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "requests.manage", session.user.permissions)
  ) {
    return null;
  }
  return session;
}

// The sidebar's open-request badge and the queue both depend on this
// segment's data; revalidating the shared layout is what keeps them in sync
// with the detail screen after any write here.
function revalidateAdmin(): void {
  revalidatePath("/admin", "layout");
}

/**
 * What the operator chose to do with the term while moving the andamento.
 * Absent choice and "manter" both mean "write nothing": a request whose term
 * nobody touched keeps following the office's default, which is what lets the
 * default reach the requests filed before any of this existed.
 *
 * "invalid" rather than a thrown error: the number came from a form, and a
 * form's bad number is a message to the operator, not a crash.
 */
function readDeadlineChoice(
  formData: FormData,
  request: { createdAt: Date; details: unknown; actId: string | null },
  tenant: Tenant,
): Deadline | undefined | "invalid" {
  const choice = String(formData.get("deadlineChoice") ?? "keep");
  if (choice !== "restart" && choice !== "days") return undefined;

  const act = request.actId
    ? getActForTenant(tenant, request.actId)
    : undefined;
  const current = effectiveDeadline(
    toIsoDate(request.createdAt, OFFICE_TIME_ZONE),
    readDeadline(request.details),
    act?.legalDeadlineDays,
    tenant.requestDeadlineDays,
  );

  // Spread, not rebuilt: a paused term stays paused, only at another point.
  if (choice === "restart") return { ...current, startedOn: today() };

  const parsed = deadlineDaysSchema.safeParse(
    Number(String(formData.get("deadlineDays") ?? "").trim()),
  );
  if (!parsed.success) return "invalid";
  return { ...current, days: parsed.data };
}

/**
 * The detail page's live check: the request's `updatedAt` now, or null when
 * there is nothing this operator may see under that id. One indexed read,
 * nothing rendered: see `LiveRequest`.
 */
export async function requestVersionAction(
  requestId: string,
): Promise<string | null> {
  if (!(await authorize())) return null;
  const tenant = await getTenant();
  const request = await findById(tenant.slug, requestId);
  return request?.updatedAt.toISOString() ?? null;
}

export async function changeStatus(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const requestId = String(formData.get("requestId") ?? "");
  // "Salvar prazo" shares this form with the andamento controls, because a
  // form cannot nest: it submits the term alone and leaves the andamento
  // where it is.
  const onlyDeadline = formData.get("intent") === "deadline";
  // A suggestion pill submits its own `status`; the correction select always
  // travels with the form and only decides when no pill was the submitter.
  const status = String(
    formData.get("status") ?? formData.get("statusOverride") ?? "",
  );
  const tenant = await getTenant();
  let emailWarning: string | null = null;
  try {
    const request = await findById(tenant.slug, requestId);
    if (!request) return { status: "error", message: "Pedido não encontrado." };
    const deadline = readDeadlineChoice(formData, request, tenant);
    if (deadline === "invalid") {
      return {
        status: "error",
        message: `Informe um prazo entre ${MIN_DEADLINE_DAYS} e ${MAX_DEADLINE_DAYS} dias.`,
      };
    }

    if (onlyDeadline) {
      // "Manter" reads the same here as it does beside an andamento change:
      // nothing to write.
      if (!deadline) {
        return {
          status: "error",
          message: "Escolha um prazo antes de salvar.",
        };
      }
      await updateRequestDeadline(
        tenant.slug,
        requestId,
        session.user.id,
        deadline,
      );
      await reconcileDeadlinePause(tenant, requestId, session.user.id, today());
      revalidateAdmin();
      return { status: "success", emailWarning: null };
    }

    if (!isServiceRequestStatus(status)) {
      return { status: "error", message: "Andamento inválido." };
    }
    // Moving to the andamento it is already in would only write an event
    // carrying no information.
    if (!isAllowedTransition(request.status as ServiceRequestStatus, status)) {
      return {
        status: "error",
        message: "O pedido já está neste andamento.",
      };
    }

    // Closing a request without delivering it, with no why, is what makes
    // the citizen call the counter to ask. Indeferido alone may carry a PDF
    // instead of the text; every other andamento that requires a reason
    // (only Cancelado) still needs the text on its own.
    const rejectionDocument = formData.get("rejectionDocument");
    const hasRejectionDocument =
      status === "rejected" &&
      rejectionDocument instanceof File &&
      rejectionDocument.size > 0;
    if (
      hasRejectionDocument &&
      (rejectionDocument as File).type !== REJECTION_DOCUMENT_MIME_TYPE
    ) {
      return { status: "error", message: "O documento precisa ser um PDF." };
    }
    let reason: string | undefined;
    if (requiresStatusReason(status)) {
      const result = validateStatusReason({
        status,
        reason: String(formData.get("reason") ?? ""),
        hasAttachment: hasRejectionDocument,
      });
      if (!result.ok) {
        return { status: "error", message: result.message };
      }
      reason = result.reason ?? undefined;
    }

    await updateRequestStatus(
      tenant.slug,
      requestId,
      status,
      session.user.id,
      deadline,
      reason,
    );
    await reconcileDeadlinePause(tenant, requestId, session.user.id, today());

    if (hasRejectionDocument) {
      const stored = await storeAttachments([rejectionDocument as File], {
        tenantSlug: tenant.slug,
        kind: "Documento do indeferimento",
      });
      await attachToRequest(
        tenant.slug,
        requestId,
        stored,
        "rejection-document",
      );
    }

    // The andamentos that end the story without the citizen reading it on
    // the consult first, plus the two that hand the citizen a new action to
    // take (go pick it up, send another comprovante). The citizen follows
    // every other step through the consult, and a message per andamento
    // would train them to ignore all of them. The motive itself never rides
    // the e-mail: it stays behind the access key, like the exigência's own
    // text. `request.status` here is still the andamento *before* the
    // update above, which is what tells a comprovante recusado (coming from
    // "payment-reported") apart from the value being recorded for the first
    // time (coming from anything else): both land on "awaiting-payment".
    const comprovanteRecusado =
      status === "awaiting-payment" && request.status === "payment-reported";
    if (
      status === "done" ||
      status === "cancelled" ||
      status === "rejected" ||
      status === "ready-for-pickup" ||
      comprovanteRecusado
    ) {
      const subject =
        status === "done"
          ? "Pedido concluído"
          : status === "cancelled"
            ? "Pedido cancelado"
            : status === "rejected"
              ? "Pedido indeferido"
              : status === "ready-for-pickup"
                ? "Pedido disponível para retirada"
                : "Comprovante não aceito";
      const body =
        status === "done"
          ? "O seu pedido foi concluído."
          : status === "cancelled"
            ? "O seu pedido foi cancelado."
            : status === "rejected"
              ? "O seu pedido foi indeferido."
              : status === "ready-for-pickup"
                ? "O seu pedido está disponível para retirada."
                : "O comprovante que você enviou não foi aceito. Consulte o protocolo com a sua chave de acesso e envie um novo comprovante.";
      emailWarning = await notifyCitizen({
        tenant,
        contact: request.contact,
        protocolNumber: request.protocolNumber,
        subject,
        body,
      });
    }
  } catch (error) {
    if (error instanceof AttachmentError) {
      return { status: "error", message: error.message };
    }
    console.error("pedidos.change-status", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success", emailWarning };
}

export async function registerRequirementAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const requestId = String(formData.get("requestId") ?? "");
  const parsed = requirementTextSchema.safeParse(
    String(formData.get("text") ?? ""),
  );
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Texto inválido.",
    };
  }

  const tenant = await getTenant();
  let emailWarning: string | null = null;
  try {
    await registerRequirement(
      tenant.slug,
      requestId,
      parsed.data,
      session.user.id,
    );
    await reconcileDeadlinePause(tenant, requestId, session.user.id, today());
    const request = await findById(tenant.slug, requestId);
    // Without the text: what the office is asking for is behind the key.
    if (request) {
      emailWarning = await notifyCitizen({
        tenant,
        contact: request.contact,
        protocolNumber: request.protocolNumber,
        subject: "Exigência registrada",
        body: "Há uma exigência no seu pedido. Consulte o protocolo com a sua chave de acesso para ver o que foi solicitado e responder.",
      });
    }
  } catch (error) {
    console.error("pedidos.register-requirement", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success", emailWarning };
}

export async function setAmountAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const requestId = String(formData.get("requestId") ?? "");
  const clearing = formData.get("intent") === "clear";
  const cents = clearing
    ? null
    : parseCentsInput(String(formData.get("amount") ?? ""));
  if (cents === undefined) {
    return { status: "error", message: "Informe um valor válido." };
  }

  const tenant = await getTenant();
  let emailWarning: string | null = null;
  try {
    // Read before the write: whether the pedido already had a value is the
    // whole difference between informing it and correcting it, and only the
    // first is news to the citizen. Correcting cents on a value already sent
    // would put an e-mail in a mailbox saying nothing new.
    const request = await findById(tenant.slug, requestId);
    await setRequestAmount(tenant.slug, requestId, cents, session.user.id);
    // The value informed moves the request to "Aguardando pagamento" by
    // itself, so the citizen's consult shows the Pix at once (decision of
    // 12/11/2026); cleared, it goes back to "Novo".
    const next =
      request && isServiceRequestStatus(request.status)
        ? statusAfterAmount(request.status, request.amountCents, cents)
        : null;
    if (next) {
      await updateRequestStatus(tenant.slug, requestId, next, session.user.id);
    }
    await reconcileDeadlinePause(tenant, requestId, session.user.id, today());

    if (!clearing && request && request.amountCents === null) {
      emailWarning = await notifyCitizen({
        tenant,
        contact: request.contact,
        protocolNumber: request.protocolNumber,
        subject: "Valor do pedido informado",
        body: "A serventia informou o valor do seu pedido. Consulte o protocolo com a sua chave de acesso para ver o valor e como pagar.",
      });
    }
  } catch (error) {
    console.error("pedidos.set-amount", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success", emailWarning };
}

/**
 * A resposta a uma consulta (`Act.consultation`): localizado ou não e o texto
 * que o cidadão lê. Conclui o pedido e avisa o cidadão por e-mail, sem o
 * conteúdo: como o motivo do indeferimento, a resposta fica atrás da chave de
 * acesso, porque fala de dados do registro.
 */
export async function answerSearchAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const parsed = searchAnswerInputSchema.safeParse({
    found: formData.get("found") ?? undefined,
    text: formData.get("text") ?? "",
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Confira a resposta.",
    };
  }

  const requestId = String(formData.get("requestId") ?? "");
  const tenant = await getTenant();
  let emailWarning: string | null = null;
  try {
    const request = await findById(tenant.slug, requestId);
    if (!request) return { status: "error", message: "Pedido não encontrado." };
    const act = request.actId
      ? getActForTenant(tenant, request.actId)
      : undefined;
    if (!act?.consultation) {
      return {
        status: "error",
        message: "Só a busca de registro é respondida assim.",
      };
    }
    await answerSearch(
      tenant.slug,
      requestId,
      { found: parsed.data.found === "yes", text: parsed.data.text },
      session.user.id,
    );
    await reconcileDeadlinePause(tenant, requestId, session.user.id, today());
    emailWarning = await notifyCitizen({
      tenant,
      contact: request.contact,
      protocolNumber: request.protocolNumber,
      subject: "Resposta da sua busca",
      body: "A serventia respondeu a sua busca de registro. Consulte o protocolo com a sua chave de acesso para ler a resposta.",
    });
  } catch (error) {
    console.error("pedidos.answer-search", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success", emailWarning };
}

const exemptionDecisionSchema = z.enum(EXEMPTION_DECISION_OUTCOMES).nullable();

/**
 * The outcome the office reaches on a gratuidade already asked for
 * (Provimento CGJ/TJRN n. 7/2026, art. 11). An empty `outcome` ("Sem
 * decisão" in the select) removes a decision recorded by mistake.
 * `setExemptionDecision` itself refuses a pedido without `exemption`, so a
 * request tampered with client-side still lands on a server-side "no".
 */
export async function setExemptionDecisionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const requestId = String(formData.get("requestId") ?? "");
  const outcome = formData.get("outcome");
  const parsed = exemptionDecisionSchema.safeParse(outcome ? outcome : null);
  if (!parsed.success) {
    return { status: "error", message: "Escolha um desfecho válido." };
  }

  const tenant = await getTenant();
  try {
    await setExemptionDecision(
      tenant.slug,
      requestId,
      parsed.data,
      session.user.id,
    );
  } catch (error) {
    console.error("pedidos.set-exemption-decision", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success" };
}

export async function deliverDocumentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const requestId = String(formData.get("requestId") ?? "");
  const tenant = await getTenant();
  let emailWarning: string | null = null;
  try {
    const files = formData
      .getAll("documento")
      .filter((f): f is File => f instanceof File && f.size > 0);
    // Every file for the client is checked for a digital signature
    // (decision of 11/11/2026). One without it goes only after the clerk
    // chose: sign it digitally here first (it stays held back, the citizen
    // does not see it until signed), confirm it is a document signed by
    // hand and scanned, or send it as it is.
    const choice = String(formData.get("assinatura") ?? "");
    const unsigned: boolean[] = await Promise.all(
      files.map(
        async (file) =>
          !fileHasDigitalSignature(
            Buffer.from(await file.arrayBuffer()),
            file.type || "",
          ),
      ),
    );
    if (
      unsigned.some(Boolean) &&
      choice !== "digital" &&
      choice !== "fisica" &&
      choice !== "sem"
    ) {
      return {
        status: "error",
        message:
          "O documento anexado não contém assinatura digital. Escolha assinar digitalmente ou confirme que é um documento físico digitalizado.",
      };
    }
    const owner = await findById(tenant.slug, requestId);
    if (!owner) return { status: "error", message: "Pedido não encontrado." };
    const alreadyDelivered = (
      await listAttachments(tenant.slug, requestId)
    ).filter((a) => a.kind === "office" && !a.requirementId).length;
    const stored = await storeAttachments(files, {
      tenantSlug: tenant.slug,
      // The name the clerk typed, or "Documento final N · protocolo".
      kind: deliveryName(
        String(formData.get("documentoName") ?? ""),
        owner.protocolNumber,
        alreadyDelivered,
      ),
    });
    if (stored.length === 0) {
      return { status: "error", message: "Escolha um arquivo para anexar." };
    }
    await attachToRequest(tenant.slug, requestId, stored, "office");
    const unsignedNames = stored
      .filter((_, index) => unsigned[index])
      .map((s) => s.storedName);
    if (choice === "digital" && unsignedNames.length) {
      await holdForSignatureWith(
        db,
        tenant.slug,
        requestId,
        unsignedNames,
        session.user.id,
      );
      // Nothing reaches the citizen yet: the e-mail goes once it is signed.
      revalidateAdmin();
      return { status: "success", held: true };
    }
    if (choice === "sem" && unsignedNames.length) {
      await recordUnsignedDeliveryWith(
        db,
        tenant.slug,
        requestId,
        files.filter((_, index) => unsigned[index]).map((f) => f.name),
        session.user.id,
      );
    }
    if (choice === "fisica") {
      await confirmPhysicalSignatureWith(
        db,
        tenant.slug,
        requestId,
        stored.filter((_, index) => unsigned[index]).map((s) => s.storedName),
        { id: session.user.id, name: session.user.name },
      );
    }

    const request = await findById(tenant.slug, requestId);
    if (request) {
      emailWarning = await notifyCitizen({
        tenant,
        contact: request.contact,
        protocolNumber: request.protocolNumber,
        subject: "Documento disponível",
        body: "A serventia disponibilizou um documento no seu pedido. Consulte o protocolo com a sua chave de acesso para baixá-lo.",
      });
    }
  } catch (error) {
    if (error instanceof AttachmentError) {
      return { status: "error", message: error.message };
    }
    console.error("pedidos.deliver-document", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success", emailWarning };
}

/**
 * The form the office attaches to a requirement, for the citizen to print and
 * present. It is stored against the requirement, so it never reaches the
 * request's delivery list and it goes when the requirement goes.
 */
export async function attachRequirementFormAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const requestId = String(formData.get("requestId") ?? "");
  const requirementId = String(formData.get("requirementId") ?? "");
  const tenant = await getTenant();
  let emailWarning: string | null = null;
  try {
    // The requirement has to be one of this request's: an id from another
    // request would otherwise hang a file off someone else's exigência.
    const requirements = await listRequirements(tenant.slug, requestId);
    if (!requirements.some((r) => r.id === requirementId)) {
      return { status: "error", message: "Exigência não encontrada." };
    }
    const files = formData
      .getAll("formulario")
      .filter((f): f is File => f instanceof File);
    const stored = await storeAttachments(files, {
      tenantSlug: tenant.slug,
      kind: "formulario-exigencia",
    });
    if (stored.length === 0) {
      return { status: "error", message: "Escolha um arquivo para anexar." };
    }
    await attachToRequest(
      tenant.slug,
      requestId,
      stored,
      "office",
      requirementId,
    );

    // Same courtesy the delivered document gets: the form is something the
    // citizen has to print and bring, and one sitting unseen behind the
    // access key is an exigência nobody can meet.
    const request = await findById(tenant.slug, requestId);
    if (request) {
      emailWarning = await notifyCitizen({
        tenant,
        contact: request.contact,
        protocolNumber: request.protocolNumber,
        subject: "Formulário disponível",
        body: "A serventia anexou um formulário à exigência do seu pedido. Consulte o protocolo com a sua chave de acesso para baixá-lo e imprimi-lo.",
      });
    }
  } catch (error) {
    if (error instanceof AttachmentError) {
      return { status: "error", message: error.message };
    }
    console.error("pedidos.attach-requirement-form", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success", emailWarning };
}

export async function deleteAttachmentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Sensitive: says why, and the reason goes to the audit.
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const requestId = String(formData.get("requestId") ?? "");
  const attachmentId = String(formData.get("attachmentId") ?? "");
  const tenant = await getTenant();
  try {
    const deleted = await deleteAttachment(
      tenant.slug,
      requestId,
      attachmentId,
      session.user.id,
    );
    if (!deleted) {
      return { status: "error", message: "Documento não encontrado." };
    }
    // Already gone if the 30-day rule purged it: only the row was left.
    if (deleted.path) await deleteStoredFile(deleted.path);
  } catch (error) {
    if (error instanceof AttachmentInUseError) {
      return { status: "error", message: error.message };
    }
    console.error("pedidos.delete-attachment", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success" };
}

export async function updateRequestDataAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const parsed = requestDataEditSchema(new Date(), OFFICE_TIME_ZONE).safeParse({
    applicantName: formData.get("applicantName") ?? "",
    contact: formData.get("contact") ?? "",
    phone: formData.get("phone") ?? "",
    cpf: formData.get("cpf") ?? "",
    noCpf: formData.get("noCpf"),
    alternateDocumentType: formData.get("alternateDocumentType"),
    alternateDocumentNumber: formData.get("alternateDocumentNumber"),
    purpose: formData.get("purpose") ?? "",
    description: formData.get("description") ?? "",
    createdAt: formData.get("createdAt") ?? "",
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Confira os campos.",
    };
  }

  const requestId = String(formData.get("requestId") ?? "");
  const tenant = await getTenant();
  try {
    const stored = await findById(tenant.slug, requestId);
    if (!stored) return { status: "error", message: GENERIC_ERROR };
    // Lei 6.015 art. 17: the act decides whether a purpose may exist at all,
    // and hiding the input is not what enforces it.
    const act = stored.actId
      ? getActForTenant(tenant, stored.actId)
      : undefined;
    const exemption = readExemption(stored.details);
    const variant = resolveVariantEdit(
      act,
      exemption?.actId,
      String(formData.get("actVariant") ?? ""),
    );
    if (!variant.ok) return { status: "error", message: variant.message };
    const { noCpf, alternateDocumentType, alternateDocumentNumber, ...fields } =
      parsed.data;
    const identity = resolveIdentityEdit(
      {
        cpf: stored.cpf,
        alternateDocument: readAlternateDocument(stored.details),
      },
      {
        cpf: fields.cpf,
        noCpf,
        alternateDocumentType,
        alternateDocumentNumber,
      },
    );
    if (!identity.ok) return { status: "error", message: identity.message };
    await updateRequestData(
      tenant.slug,
      requestId,
      {
        ...fields,
        cpf: identity.cpf,
        alternateDocument: identity.alternateDocument,
        purpose: purposeFor(act, fields.purpose, {
          variantId: variant.actVariant ?? readActVariant(stored.details),
          exemptionActId: exemption?.actId,
          certificateType: exemption?.certificateType,
        }),
        actVariant: variant.actVariant,
      },
      session.user.id,
    );
  } catch (error) {
    console.error("pedidos.update-data", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success" };
}

export async function deleteRequestAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Sensitive: says why, and the reason goes to the audit.
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const requestId = String(formData.get("requestId") ?? "");
  const tenant = await getTenant();
  try {
    await deleteRequest(tenant.slug, requestId, session.user.id);
  } catch (error) {
    console.error("pedidos.delete", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  // Outside the try block: redirect() throws by design, and catching that
  // here would turn a successful deletion into a reported failure.
  redirect("/admin/pedidos");
}

/**
 * The office declares the requirement met. The citizen sending something is
 * evidence, never the verdict: only whoever asked can say the answer answers.
 */
export async function resolveRequirementAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const requirementId = String(formData.get("requirementId") ?? "");
  const tenant = await getTenant();
  try {
    const requestId = await resolveRequirement(
      tenant.slug,
      requirementId,
      session.user.id,
    );
    if (!requestId) {
      return {
        status: "error",
        message: "Esta exigência não foi encontrada ou já está cumprida.",
      };
    }
    await reconcileDeadlinePause(tenant, requestId, session.user.id, today());
  } catch (error) {
    console.error("pedidos.resolve-requirement", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success" };
}

/** Corrects the wording of a requirement the citizen has not answered yet. */
export async function editRequirementAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const requirementId = String(formData.get("requirementId") ?? "");
  const parsed = requirementTextSchema.safeParse(
    String(formData.get("text") ?? ""),
  );
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Texto inválido.",
    };
  }

  const tenant = await getTenant();
  try {
    const updated = await updateRequirementText(
      tenant.slug,
      requirementId,
      parsed.data,
      session.user.id,
    );
    if (!updated) {
      return {
        status: "error",
        message: "Só é possível editar uma exigência ainda pendente.",
      };
    }
  } catch (error) {
    console.error("pedidos.edit-requirement", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success" };
}

/** Undoes a requirement raised by mistake, with its conversation and files. */
export async function deleteRequirementAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Sensitive: says why, and the reason goes to the audit.
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const requirementId = String(formData.get("requirementId") ?? "");
  const tenant = await getTenant();
  try {
    // The rows go by cascade; the bytes are ours to remove, and only after
    // the rows that pointed at them are gone.
    const deleted = await deleteRequirement(
      tenant.slug,
      requirementId,
      session.user.id,
    );
    if (deleted) {
      for (const path of deleted.paths) await deleteStoredFile(path);
      await reconcileDeadlinePause(
        tenant,
        deleted.requestId,
        session.user.id,
        today(),
      );
    }
  } catch (error) {
    console.error("pedidos.delete-requirement", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success" };
}

/** The office answers in the requirement's conversation. */
export async function replyRequirementAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const requirementId = String(formData.get("requirementId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) {
    return { status: "error", message: "Escreva a resposta." };
  }

  const tenant = await getTenant();
  let emailWarning: string | null = null;
  try {
    const written = await writeStaffMessage(
      tenant.slug,
      requirementId,
      body,
      session.user.id,
    );
    if (!written) {
      return {
        status: "error",
        message: "Esta exigência não foi encontrada ou já está cumprida.",
      };
    }

    const request = await findById(tenant.slug, written.requestId);
    // The answer itself stays behind the key; this only says one arrived.
    if (request) {
      emailWarning = await notifyCitizen({
        tenant,
        contact: request.contact,
        protocolNumber: request.protocolNumber,
        subject: "Mensagem da serventia",
        body: "A serventia respondeu na exigência do seu pedido. Consulte o protocolo com a sua chave de acesso para ler e responder.",
      });
    }
  } catch (error) {
    console.error("pedidos.reply-requirement", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success", emailWarning };
}

/**
 * The counter case: the citizen arrives with the paper in hand, and whoever
 * is serving them scans it and attaches it here. It lands in the citizen's
 * own document list, the same place the ones sent through the site land.
 */
export async function attachCitizenDocumentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const requestId = String(formData.get("requestId") ?? "");
  const tenant = await getTenant();
  // What the scanned paper is: a document the citizen brought (the default,
  // and everything this form ever attached before), or the requerimento or
  // declaração they signed by hand at the counter, which then counts as the
  // signed copy the header opens (see `signedFormFor`).
  const como = formData.get("como") ?? "documento";
  const signedAs = isSignedFormDocument(como) ? como : undefined;
  try {
    if (signedAs === "declaracao") {
      const request = await findById(tenant.slug, requestId);
      if (!request || !readExemption(request.details)) {
        return { status: "error", message: "Este pedido não tem declaração." };
      }
    }
    const files = formData
      .getAll("documento")
      .filter((f): f is File => f instanceof File);
    const stored = await storeAttachments(files, {
      tenantSlug: tenant.slug,
      kind: signedAs ? SIGNED_FORM_NAMES[signedAs] : undefined,
      // A signed form keeps its fixed name; any other file, the one typed.
      name: signedAs ? undefined : String(formData.get("documentoName") ?? ""),
    });
    if (stored.length === 0) {
      return { status: "error", message: "Escolha um arquivo para anexar." };
    }
    await attachToRequest(
      tenant.slug,
      requestId,
      stored,
      signedAs ? "signed-form" : "citizen",
    );
  } catch (error) {
    if (error instanceof AttachmentError) {
      return { status: "error", message: error.message };
    }
    console.error("pedidos.attach-citizen-document", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success" };
}

/**
 * Signs a delivered document with the office's certificate: the citizen then
 * downloads the signed version, with the band and the verification QR.
 */
export async function signDeliveredAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };
  const tenant = await getTenant();
  const requestId = String(formData.get("requestId") ?? "");
  const request = await findById(tenant.slug, requestId);
  if (!request) return { status: "error", message: "Pedido não encontrado." };
  const origin = await requestOrigin();
  const attachmentId = String(formData.get("attachmentId") ?? "");
  const wasHeld = await isHeldForSignatureWith(
    db,
    tenant.slug,
    requestId,
    attachmentId,
  ).catch(() => false);
  try {
    await signDeliveredDocumentWith(
      db,
      tenant.slug,
      {
        requestId,
        attachmentId,
        protocolNumber: request.protocolNumber,
        certificateId: String(formData.get("certificateId") ?? ""),
        password: String(formData.get("password") ?? ""),
        verifyUrl: (code) => verifyUrlFor(tenant, origin, code),
        location: `${tenant.location.city}/${tenant.location.state}`,
        officeName: officialName(tenant),
      },
      session.user.id,
    );
  } catch (error) {
    if (
      error instanceof SigningError ||
      error instanceof CertificatePasswordError ||
      error instanceof PdfNotSignableError
    ) {
      return { status: "error", message: error.message };
    }
    console.error("pedidos.sign-delivered", error);
    return {
      status: "error",
      message: "Não foi possível assinar este PDF agora. Tente de novo.",
    };
  }
  revalidateAdmin();
  return {
    status: "success",
    emailWarning: wasHeld ? await announceDelivery(tenant, request) : null,
  };
}

/** The e-mail that tells the citizen a document is ready to download. */
async function announceDelivery(
  tenant: Tenant,
  request: { contact: string | null; protocolNumber: string },
): Promise<string | null> {
  return notifyCitizen({
    tenant,
    contact: request.contact,
    protocolNumber: request.protocolNumber,
    subject: "Documento disponível",
    body: "A serventia disponibilizou um documento no seu pedido. Consulte o protocolo com a sua chave de acesso para baixá-lo.",
  });
}

/**
 * A held file sent as it is, with no digital signature: only when the clerk
 * chooses it (decision of 11/11/2026). Recorded in the audit.
 */
export async function releaseUnsignedAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };
  const tenant = await getTenant();
  const requestId = String(formData.get("requestId") ?? "");
  const request = await findById(tenant.slug, requestId);
  if (!request) return { status: "error", message: "Pedido não encontrado." };
  const released = await releaseUnsignedWith(
    db,
    tenant.slug,
    requestId,
    String(formData.get("attachmentId") ?? ""),
    session.user.id,
  );
  if (!released) {
    return { status: "error", message: "Este documento já foi enviado." };
  }
  revalidateAdmin();
  return {
    status: "success",
    emailWarning: await announceDelivery(tenant, request),
  };
}

/** Gives a delivered document the name the citizen will see. */
export async function renameDeliveredAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };
  const name = sanitizeDeliveryName(String(formData.get("novoName") ?? ""));
  if (!name)
    return { status: "error", message: "Informe o nome do documento." };
  const tenant = await getTenant();
  const renamed = await renameDeliveredAttachment(
    tenant.slug,
    String(formData.get("requestId") ?? ""),
    String(formData.get("attachmentId") ?? ""),
    name,
    session.user.id,
  ).catch(() => false);
  if (!renamed)
    return { status: "error", message: "Não foi possível renomear." };
  revalidateAdmin();
  return { status: "success" };
}

/* ----------------------------------- delivered PDF signed with an A3 token */

export type A3DeliveryStep =
  | { status: "prepared"; token: string; toBeSigned: string }
  | { status: "error"; message: string };

function tokenCertificate(formData: FormData) {
  let chain: unknown = [];
  try {
    chain = JSON.parse(String(formData.get("chain") ?? "[]"));
  } catch {
    chain = [];
  }
  return {
    holderDer: Buffer.from(String(formData.get("holder") ?? ""), "base64"),
    chainDer: (Array.isArray(chain) ? chain : [])
      .slice(0, 8)
      .map((item) => Buffer.from(String(item), "base64")),
  };
}

function signingFailure(error: unknown, where: string) {
  if (
    error instanceof SigningError ||
    error instanceof CertificatePasswordError ||
    error instanceof PdfNotSignableError
  ) {
    return { status: "error" as const, message: error.message };
  }
  console.error(where, error);
  return {
    status: "error" as const,
    message: "Não foi possível assinar este PDF agora. Tente de novo.",
  };
}

/** A3, step one: prepare the delivered PDF for the token (decision of 11/11/2026). */
export async function prepareA3DeliveryAction(
  formData: FormData,
): Promise<A3DeliveryStep> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };
  const tenant = await getTenant();
  const requestId = String(formData.get("requestId") ?? "");
  const request = await findById(tenant.slug, requestId);
  if (!request) return { status: "error", message: "Pedido não encontrado." };
  const origin = await requestOrigin();
  try {
    const prepared = await prepareA3DeliveryWith(
      db,
      tenant.slug,
      {
        ...tokenCertificate(formData),
        requestId,
        attachmentId: String(formData.get("attachmentId") ?? ""),
        protocolNumber: request.protocolNumber,
        verifyUrl: (code) => verifyUrlFor(tenant, origin, code),
        location: `${tenant.location.city}/${tenant.location.state}`,
        officeName: officialName(tenant),
      },
      session.user.id,
    );
    return {
      status: "prepared",
      token: prepared.token,
      toBeSigned: prepared.toBeSigned.toString("base64"),
    };
  } catch (error) {
    return signingFailure(error, "pedidos.a3.prepare");
  }
}

/** A3, step two: the token's signature comes back; the client's copy is replaced. */
export async function finishA3DeliveryAction(
  formData: FormData,
): Promise<
  { status: "signed"; id: string } | { status: "error"; message: string }
> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };
  const tenant = await getTenant();
  const requestId = String(formData.get("requestId") ?? "");
  const attachmentId = String(formData.get("attachmentId") ?? "");
  const wasHeld = await isHeldForSignatureWith(
    db,
    tenant.slug,
    requestId,
    attachmentId,
  ).catch(() => false);
  try {
    const { id } = await finishA3DeliveryWith(
      db,
      tenant.slug,
      {
        ...tokenCertificate(formData),
        token: String(formData.get("token") ?? ""),
        signature: Buffer.from(
          String(formData.get("signature") ?? ""),
          "base64",
        ),
        requestId,
        attachmentId,
      },
      session.user.id,
    );
    revalidateAdmin();
    if (wasHeld) {
      const request = await findById(tenant.slug, requestId);
      if (request) await announceDelivery(tenant, request);
    }
    return { status: "signed", id };
  } catch (error) {
    return signingFailure(error, "pedidos.a3.finish");
  }
}

/**
 * The office's check of a requerimento sent as a scan or a photo (decision
 * of 12/11/2026): wrong, it goes back to the citizen with the reason, read
 * on the protocol's page; the e-mail only says there is something to see.
 * Right, the office frees the pedido by the andamento ("Requerimento
 * conferido: liberar o pedido").
 */
export async function returnSignedFormAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };
  const requestId = String(formData.get("requestId") ?? "");
  const reason = String(formData.get("motivo") ?? "")
    .trim()
    .slice(0, 5000);
  if (reason.length < 3) {
    return {
      status: "error",
      message: "Escreva o motivo da devolução, para o solicitante entender.",
    };
  }
  let emailWarning: string | null = null;
  try {
    const tenant = await getTenant();
    const request = await findById(tenant.slug, requestId);
    if (!request) return { status: "error", message: "Pedido não encontrado." };
    if (request.status !== "awaiting-signed-form") {
      return {
        status: "error",
        message: "Este pedido não está aguardando o requerimento assinado.",
      };
    }
    const previous = readSignedFormCheck(request.details);
    await saveSignedFormCheckWith(
      db,
      tenant.slug,
      requestId,
      {
        verdict: "returned",
        reason: previous?.reason ?? "",
        checkedAt: new Date().toISOString(),
        returnedReason: reason,
      },
      session.user.id,
    );
    emailWarning = await notifyCitizen({
      tenant,
      contact: request.contact,
      protocolNumber: request.protocolNumber,
      subject: "Requerimento devolvido",
      body: "O cartório conferiu o requerimento enviado e precisa de outro arquivo. Consulte o protocolo com a sua chave de acesso para ver o motivo e enviar o requerimento correto, assinado digitalmente pelo gov.br ou assinado a punho com firma reconhecida.",
    });
  } catch (error) {
    console.error("pedidos.return-signed-form", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success", emailWarning };
}

export type ReissueKeyState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "success";
      /** Shown once, to read out or print: the database keeps only its
       * hash. */
      accessKey: string;
      /** Where it went, or null when the contact is not an e-mail. */
      sentTo: string | null;
      emailWarning: string | null;
    };

/**
 * A new access key for a client who lost it or gave a wrong e-mail
 * (decision of 13/11/2026). The key on file cannot be read back (only its
 * hash is kept), so the office issues a new one: the old one stops working,
 * the new one goes to the e-mail on file with the link that opens the
 * pedido, and is shown here once, to print the receipt for the client.
 * Correct the e-mail first, in "Dados do solicitante", if it was wrong.
 */
export async function reissueKeyAction(
  _previous: ReissueKeyState,
  formData: FormData,
): Promise<ReissueKeyState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };
  const requestId = String(formData.get("requestId") ?? "");
  try {
    const tenant = await getTenant();
    const request = await findById(tenant.slug, requestId);
    if (!request) return { status: "error", message: "Pedido não encontrado." };
    const accessKey = await reissueAccessKey(
      tenant.slug,
      requestId,
      session.user.id,
    );
    const email =
      request.contact && isEmailContact(request.contact)
        ? request.contact.trim()
        : null;
    const emailWarning = email
      ? await sendAccessKey({
          tenant,
          contact: email,
          protocolNumber: request.protocolNumber,
          accessKey,
          reason: "office",
        })
      : null;
    revalidateAdmin();
    return { status: "success", accessKey, sentTo: email, emailWarning };
  } catch (error) {
    console.error("pedidos.reissue-key", error);
    return { status: "error", message: GENERIC_ERROR };
  }
}
