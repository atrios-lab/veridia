"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import {
  attachToRequest,
  respondToRecord,
  saveDraftReply,
} from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AttachmentError, storeAttachments } from "@/lib/uploads.ts";

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
    const files = formData
      .getAll("relatorio")
      .filter((f): f is File => f instanceof File);
    const stored = await storeAttachments(files, { kind: "office" });
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
