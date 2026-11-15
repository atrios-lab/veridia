"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import { MIN_JUSTIFICATION } from "@/core/text-limits.ts";
import { db } from "@/db/index.ts";
import { setAiPolicyWith } from "@/lib/ai.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export type AiState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

/** The Tabelião/Registrador turns the AI on or off, with the reason. */
export async function setOfficeAi(
  _previous: AiState,
  formData: FormData,
): Promise<AiState> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "user.manage", session.user.permissions)
  ) {
    return {
      status: "error",
      message: "Só o Tabelião liga ou desliga o Assistente Virtual.",
    };
  }
  const enabled = formData.get("ai") === "on";
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < MIN_JUSTIFICATION) {
    return {
      status: "error",
      message: `Diga o motivo (pelo menos ${MIN_JUSTIFICATION} letras). Ele vai para a auditoria.`,
    };
  }
  const tenant = await getTenant();
  await setAiPolicyWith(db, tenant.slug, enabled, reason, session.user.id);
  revalidatePath("/admin/configuracoes/assistente-virtual");
  return {
    status: "saved",
    message: enabled
      ? "Assistente Virtual ligado."
      : "Assistente Virtual desligado.",
  };
}
