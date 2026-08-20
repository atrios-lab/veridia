"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import { notifyCitizen } from "@/lib/email/service-request.ts";
import {
  findById,
  respondToRecord,
  saveDraftReply,
  saveInternalNote as saveInternalNoteRecord,
} from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export type ActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

const NO_PERMISSION =
  "Você não tem permissão para responder esta manifestação.";
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

export async function respondManifestation(
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
    const request = await findById(tenant.slug, requestId);
    if (!request) {
      return { status: "error", message: "Manifestação não encontrada." };
    }

    await respondToRecord(
      tenant.slug,
      requestId,
      "ombudsman",
      reply,
      "answered",
      session.user.id,
    );

    // No check for anonymity here on purpose: `notifyCitizen` already gives up
    // silently on a null contact and on a telephone. A manifestation with
    // nobody to write to is what the channel promises on its first screen, not
    // a delivery that failed, and logging it would fill the log with noise
    // about people exercising a right.
    void notifyCitizen({
      tenant,
      contact: request.contact,
      protocolNumber: request.protocolNumber,
      subject: "Manifestação respondida",
      body: "A ouvidoria respondeu à sua manifestação. Consulte o registro com a sua chave de acesso para ler a resposta.",
    });
  } catch (error) {
    console.error("ouvidoria.respond", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success" };
}

export async function saveManifestationDraft(
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
      "ombudsman",
      draft,
      session.user.id,
    );
  } catch (error) {
    console.error("ouvidoria.save-draft", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success" };
}

export async function saveInternalNote(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const requestId = String(formData.get("requestId") ?? "");
  const note = String(formData.get("note") ?? "");

  const tenant = await getTenant();
  try {
    await saveInternalNoteRecord(tenant.slug, requestId, note, session.user.id);
  } catch (error) {
    console.error("ouvidoria.internal-note", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success" };
}
