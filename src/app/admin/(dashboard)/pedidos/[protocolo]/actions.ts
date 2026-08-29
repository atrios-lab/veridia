"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActForTenant } from "@/core/acts/catalog.ts";
import { can } from "@/core/auth/roles.ts";
import {
  type Deadline,
  deadlineDaysSchema,
  effectiveDeadline,
  MAX_DEADLINE_DAYS,
  MIN_DEADLINE_DAYS,
  readDeadline,
} from "@/core/request/deadline.ts";
import { purposeFor, requestDataEditSchema } from "@/core/request/edit.ts";
import {
  isAllowedTransition,
  isServiceRequestStatus,
  type ServiceRequestStatus,
} from "@/core/request/kinds.ts";
import { parseCentsInput } from "@/core/request/money.ts";
import { requirementTextSchema } from "@/core/request/requirement.ts";
import { toIsoDate } from "@/core/scheduling/calendar.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { notifyCitizen } from "@/lib/email/service-request.ts";
import {
  AttachmentInUseError,
  attachToRequest,
  deleteAttachment,
  deleteRequest,
  deleteRequirement,
  findById,
  listRequirements,
  registerRequirement,
  reissueAccessKey,
  resolveRequirement,
  setRequestAmount,
  updateRequestData,
  updateRequestStatus,
  updateRequirementText,
  writeStaffMessage,
} from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
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
  | { status: "success"; emailWarning?: string | null };

const NO_PERMISSION = "Você não tem permissão para alterar este pedido.";
const GENERIC_ERROR =
  "Não foi possível salvar agora. Tente novamente em instantes.";

/** Every action here re-checks on the server: the sidebar hiding the link, and
 * the page 404-ing, are both a courtesy: never the gate. */
async function authorize() {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "requests.manage")) {
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
  request: { createdAt: Date; details: unknown },
  tenant: Tenant,
): Deadline | undefined | "invalid" {
  const choice = String(formData.get("deadlineChoice") ?? "keep");
  if (choice !== "restart" && choice !== "days") return undefined;

  const current = effectiveDeadline(
    toIsoDate(request.createdAt, OFFICE_TIME_ZONE),
    readDeadline(request.details),
    tenant.requestDeadlineDays,
  );

  if (choice === "restart") return { startedOn: today(), days: current.days };

  const parsed = deadlineDaysSchema.safeParse(
    Number(String(formData.get("deadlineDays") ?? "").trim()),
  );
  if (!parsed.success) return "invalid";
  return { startedOn: current.startedOn, days: parsed.data };
}

export async function changeStatus(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const requestId = String(formData.get("requestId") ?? "");
  // A suggestion pill submits its own `status`; the correction select always
  // travels with the form and only decides when no pill was the submitter.
  const status = String(
    formData.get("status") ?? formData.get("statusOverride") ?? "",
  );
  if (!isServiceRequestStatus(status)) {
    return { status: "error", message: "Andamento inválido." };
  }

  const tenant = await getTenant();
  let emailWarning: string | null = null;
  try {
    const request = await findById(tenant.slug, requestId);
    if (!request) return { status: "error", message: "Pedido não encontrado." };
    // Moving to the andamento it is already in would only write an event
    // carrying no information.
    if (!isAllowedTransition(request.status as ServiceRequestStatus, status)) {
      return {
        status: "error",
        message: "O pedido já está neste andamento.",
      };
    }

    const deadline = readDeadlineChoice(formData, request, tenant);
    if (deadline === "invalid") {
      return {
        status: "error",
        message: `Informe um prazo entre ${MIN_DEADLINE_DAYS} e ${MAX_DEADLINE_DAYS} dias.`,
      };
    }

    await updateRequestStatus(
      tenant.slug,
      requestId,
      status,
      session.user.id,
      deadline,
    );

    // Only the two that end the story. The citizen follows the rest through
    // the consult, and a message per andamento would train them to ignore all
    // of them.
    if (status === "done" || status === "cancelled") {
      emailWarning = await notifyCitizen({
        tenant,
        contact: request.contact,
        protocolNumber: request.protocolNumber,
        subject: status === "done" ? "Pedido concluído" : "Pedido cancelado",
        body:
          status === "done"
            ? "O seu pedido foi concluído."
            : "O seu pedido foi cancelado.",
      });
    }
  } catch (error) {
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
  const cents = parseCentsInput(String(formData.get("amount") ?? ""));
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

    if (request && request.amountCents === null) {
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
      .filter((f): f is File => f instanceof File);
    const stored = await storeAttachments(files, {
      tenantSlug: tenant.slug,
      kind: "documento-final",
    });
    if (stored.length === 0) {
      return { status: "error", message: "Escolha um arquivo para anexar." };
    }
    await attachToRequest(tenant.slug, requestId, stored, "office");

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
    await deleteStoredFile(deleted.path);
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

export type ReissueKeyState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; key: string };

export async function updateRequestDataAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const parsed = requestDataEditSchema(new Date(), OFFICE_TIME_ZONE).safeParse({
    applicantName: formData.get("applicantName") ?? "",
    contact: formData.get("contact") ?? "",
    cpf: formData.get("cpf") ?? "",
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
    await updateRequestData(
      tenant.slug,
      requestId,
      { ...parsed.data, purpose: purposeFor(act, parsed.data.purpose) },
      session.user.id,
    );
  } catch (error) {
    console.error("pedidos.update-data", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success" };
}

export async function reissueKeyAction(
  _previous: ReissueKeyState,
  formData: FormData,
): Promise<ReissueKeyState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const requestId = String(formData.get("requestId") ?? "");
  const tenant = await getTenant();
  try {
    const key = await reissueAccessKey(tenant.slug, requestId, session.user.id);
    revalidateAdmin();
    return { status: "success", key };
  } catch (error) {
    console.error("pedidos.reissue-key", error);
    return { status: "error", message: GENERIC_ERROR };
  }
}

export async function deleteRequestAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
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
    const done = await resolveRequirement(
      tenant.slug,
      requirementId,
      session.user.id,
    );
    if (!done) {
      return {
        status: "error",
        message: "Esta exigência não foi encontrada ou já está cumprida.",
      };
    }
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
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const requirementId = String(formData.get("requirementId") ?? "");
  const tenant = await getTenant();
  try {
    // The rows go by cascade; the bytes are ours to remove, and only after
    // the rows that pointed at them are gone.
    const paths = await deleteRequirement(
      tenant.slug,
      requirementId,
      session.user.id,
    );
    for (const path of paths) await deleteStoredFile(path);
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
  try {
    const files = formData
      .getAll("documento")
      .filter((f): f is File => f instanceof File);
    const stored = await storeAttachments(files, { tenantSlug: tenant.slug });
    if (stored.length === 0) {
      return { status: "error", message: "Escolha um arquivo para anexar." };
    }
    await attachToRequest(tenant.slug, requestId, stored, "citizen");
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
