"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActForTenant } from "@/core/acts/catalog.ts";
import { can } from "@/core/auth/roles.ts";
import { purposeFor, requestDataEditSchema } from "@/core/request/edit.ts";
import { isServiceRequestStatus } from "@/core/request/kinds.ts";
import { parseCentsInput } from "@/core/request/money.ts";
import { requirementTextSchema } from "@/core/request/requirement.ts";
import {
  AttachmentInUseError,
  attachToRequest,
  deleteAttachment,
  deleteRequest,
  findById,
  listRequirements,
  registerRequirement,
  reissueAccessKey,
  setRequestAmount,
  updateRequestData,
  updateRequestStatus,
} from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, OFFICE_TIME_ZONE } from "@/lib/tenant.ts";
import {
  AttachmentError,
  deleteStoredFile,
  storeAttachments,
} from "@/lib/uploads.ts";

export type ActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

const NO_PERMISSION = "Você não tem permissão para alterar este pedido.";
const GENERIC_ERROR =
  "Não foi possível salvar agora. Tente novamente em instantes.";

/** Every action here re-checks on the server: the sidebar hiding the link, and
 * the page 404-ing, are both a courtesy — never the gate. */
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

export async function changeStatus(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const requestId = String(formData.get("requestId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!isServiceRequestStatus(status)) {
    return { status: "error", message: "Andamento inválido." };
  }

  const tenant = await getTenant();
  try {
    await updateRequestStatus(tenant.slug, requestId, status, session.user.id);
  } catch (error) {
    console.error("pedidos.change-status", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success" };
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
  try {
    await registerRequirement(
      tenant.slug,
      requestId,
      parsed.data,
      session.user.id,
    );
  } catch (error) {
    console.error("pedidos.register-requirement", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success" };
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
  try {
    await setRequestAmount(tenant.slug, requestId, cents, session.user.id);
  } catch (error) {
    console.error("pedidos.set-amount", error);
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
  try {
    const files = formData
      .getAll("documento")
      .filter((f): f is File => f instanceof File);
    const stored = await storeAttachments(files, {
      kind: "documento-final",
    });
    if (stored.length === 0) {
      return { status: "error", message: "Escolha um arquivo para anexar." };
    }
    await attachToRequest(tenant.slug, requestId, stored, "office");
  } catch (error) {
    if (error instanceof AttachmentError) {
      return { status: "error", message: error.message };
    }
    console.error("pedidos.deliver-document", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success" };
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
  } catch (error) {
    if (error instanceof AttachmentError) {
      return { status: "error", message: error.message };
    }
    console.error("pedidos.attach-requirement-form", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success" };
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
