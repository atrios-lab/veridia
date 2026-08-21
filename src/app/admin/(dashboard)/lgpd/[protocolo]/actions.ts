"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import { notifyCitizen } from "@/lib/email/service-request.ts";
import {
  AttachmentInUseError,
  attachToRequest,
  deleteAttachment,
  findById,
  respondToRecord,
  saveDraftReply,
} from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import {
  AttachmentError,
  deleteStoredFile,
  storeAttachments,
} from "@/lib/uploads.ts";

export type ActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

const NO_PERMISSION =
  "Você não tem permissão para responder este requerimento.";
const GENERIC_ERROR =
  "Não foi possível salvar agora. Tente novamente em instantes.";

/** Every action here re-checks on the server, same discipline as
 * `/admin/pedidos`: hiding the link and the page 404-ing are a courtesy. */
async function authorize() {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "channels.manage")) {
    return null;
  }
  return session;
}

function revalidateAdmin(): void {
  revalidatePath("/admin", "layout");
}

export async function respondDataRights(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const requestId = String(formData.get("requestId") ?? "");
  const reply = String(formData.get("reply") ?? "").trim();
  if (!reply) {
    return { status: "error", message: "Escreva a resposta antes de enviar." };
  }

  const tenant = await getTenant();
  try {
    // Read before writing: the notice below needs the holder's e-mail and the
    // protocol number, and a `requestId` that matches nothing should be
    // refused here rather than written into silently.
    const request = await findById(tenant.slug, requestId);
    if (!request) {
      return { status: "error", message: "Requerimento não encontrado." };
    }

    const files = formData
      .getAll("relatorio")
      .filter((f): f is File => f instanceof File);
    const stored = await storeAttachments(files, {
      tenantSlug: tenant.slug,
      kind: "office",
    });
    if (stored.length > 0) {
      await attachToRequest(tenant.slug, requestId, stored, "office");
    }
    await respondToRecord(
      tenant.slug,
      requestId,
      "data-rights",
      reply,
      "answered",
      session.user.id,
    );

    // The answer itself stays behind the key: a data rights requerimento
    // carries the holder's own personal data, and e-mail is the channel the
    // office does not control. Best effort, like every other notice here.
    void notifyCitizen({
      tenant,
      contact: request.contact,
      protocolNumber: request.protocolNumber,
      subject: "Requerimento respondido",
      body: "O Encarregado respondeu ao seu requerimento. Consulte o protocolo com a sua chave de acesso para ler a resposta.",
    });
  } catch (error) {
    if (error instanceof AttachmentError) {
      return { status: "error", message: error.message };
    }
    console.error("lgpd.respond", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success" };
}

export async function saveDataRightsDraft(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const requestId = String(formData.get("requestId") ?? "");
  const draft = String(formData.get("reply") ?? "");

  const tenant = await getTenant();
  try {
    await saveDraftReply(
      tenant.slug,
      requestId,
      "data-rights",
      draft,
      session.user.id,
    );
  } catch (error) {
    console.error("lgpd.save-draft", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success" };
}

/**
 * Removes any file hanging off this requirement: the report the office
 * attached to its reply, or the document the holder sent to identify
 * themselves. Same reach the service request panel has.
 */
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
    console.error("lgpd.delete-attachment", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success" };
}
