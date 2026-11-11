"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { messageBodySchema } from "@/core/chat/message.ts";
import {
  ChatTransferError,
  closeConversation,
  getConversation,
  nudgeConversation,
  sendMessage,
  transferConversation,
} from "@/lib/chat.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export type ActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

const NO_PERMISSION = "Você não tem permissão para esta ação.";
const GENERIC_ERROR =
  "Não foi possível concluir agora. Tente novamente em instantes.";

async function authorize() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "chat.manage", session.user.permissions)
  )
    return null;
  return session;
}

function revalidateConversation(id: string): void {
  revalidatePath(`/admin/atendimento/${id}`);
  revalidatePath("/admin/atendimento");
}

export async function sendStaffMessageAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const conversationId = String(formData.get("conversationId") ?? "");
  const parsed = messageBodySchema.safeParse(formData.get("body"));
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Mensagem inválida.",
    };
  }

  const tenant = await getTenant();
  try {
    await sendMessage(tenant.slug, conversationId, "staff", parsed.data, {
      actorUserId: session.user.id,
    });
  } catch (error) {
    console.error("atendimento.send-message", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateConversation(conversationId);
  return { status: "success" };
}

/**
 * "Chamar atenção" from the office: no limit, the office's own conversation
 * to keep moving. The citizen's screen shakes and rings when it sees it.
 */
export async function nudgeCitizenAction(
  conversationId: string,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };
  const tenant = await getTenant();
  try {
    const conversation = await getConversation(tenant.slug, conversationId);
    if (!conversation) return { status: "error", message: GENERIC_ERROR };
    const outcome = await nudgeConversation(
      tenant.slug,
      conversation,
      "office",
    );
    if (!outcome.ok) {
      return { status: "error", message: "Esta conversa já foi encerrada." };
    }
  } catch (error) {
    console.error("atendimento.nudge", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateConversation(conversationId);
  return { status: "success" };
}

export async function registerNoteAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const conversationId = String(formData.get("conversationId") ?? "");
  const parsed = messageBodySchema.safeParse(formData.get("note"));
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Nota inválida.",
    };
  }

  const tenant = await getTenant();
  try {
    await sendMessage(tenant.slug, conversationId, "note", parsed.data, {
      actorUserId: session.user.id,
    });
  } catch (error) {
    console.error("atendimento.register-note", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateConversation(conversationId);
  return { status: "success" };
}

export async function transferConversationAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const conversationId = String(formData.get("conversationId") ?? "");
  const toUserId = String(formData.get("toUserId") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "");

  const tenant = await getTenant();
  try {
    await transferConversation(
      tenant.slug,
      conversationId,
      toUserId,
      note,
      session.user.id,
    );
  } catch (error) {
    if (error instanceof ChatTransferError) {
      return { status: "error", message: error.message };
    }
    console.error("atendimento.transfer", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateConversation(conversationId);
  return { status: "success" };
}

export async function closeConversationAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const conversationId = String(formData.get("conversationId") ?? "");
  const linkedRequestId =
    String(formData.get("linkedRequestId") ?? "").trim() || undefined;

  const tenant = await getTenant();
  try {
    await closeConversation(
      tenant.slug,
      conversationId,
      { kind: "staff", userId: session.user.id },
      { linkedRequestId },
    );
  } catch (error) {
    console.error("atendimento.close", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath("/admin/atendimento");
  redirect("/admin/atendimento");
}
