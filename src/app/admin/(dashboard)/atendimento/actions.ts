"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { isChatAvailability } from "@/core/chat/hours.ts";
import {
  assignConversation,
  ChatCapacityError,
  setChatAvailability,
  setChatStatus,
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

function revalidateAdmin(): void {
  revalidatePath("/admin", "layout");
}

export async function toggleChatEnabledAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "chat.settings")) {
    return { status: "error", message: NO_PERMISSION };
  }
  const tenant = await getTenant();
  const availability = String(formData.get("availability") ?? "");
  if (!isChatAvailability(availability)) {
    return { status: "error", message: GENERIC_ERROR };
  }
  try {
    await setChatAvailability(tenant.slug, availability, session.user.id);
  } catch (error) {
    console.error("atendimento.toggle-chat", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success" };
}

export async function assignConversationAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "chat.manage")) {
    return { status: "error", message: NO_PERMISSION };
  }
  const tenant = await getTenant();
  const conversationId = String(formData.get("conversationId") ?? "");
  try {
    await assignConversation(tenant.slug, conversationId, session.user.id);
  } catch (error) {
    if (error instanceof ChatCapacityError) {
      return { status: "error", message: error.message };
    }
    console.error("atendimento.assign", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  redirect(`/admin/atendimento/${conversationId}`);
}

const CHAT_STATUSES = ["available", "busy", "away"] as const;

export async function setStatusAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "chat.manage")) {
    return { status: "error", message: NO_PERMISSION };
  }
  const value = String(formData.get("status") ?? "");
  if (!(CHAT_STATUSES as readonly string[]).includes(value)) {
    return { status: "error", message: "Status inválido." };
  }
  try {
    await setChatStatus(session.user.id, value);
  } catch (error) {
    console.error("atendimento.set-status", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success" };
}
