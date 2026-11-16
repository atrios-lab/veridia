"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import { isNoteReviewMode } from "@/core/qualificacao/revisao-base.ts";
import { isRegisteredSlug } from "@/core/tenant/resolve.ts";
import { db } from "@/db/index.ts";
import { setAiPlatformWith } from "@/lib/ai-platform.ts";
import { getSession } from "@/lib/session.ts";

export type PlatformState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

/**
 * One office's Assistente Virtual (decision of 16/11/2026): allowed or held
 * back, and how the notes attached to exigências are reviewed. Takes effect
 * at once; changing it again is always possible.
 */
export async function setAiPlatformAction(
  _previous: PlatformState,
  formData: FormData,
): Promise<PlatformState> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "ai.oversee", session.user.permissions)
  ) {
    return { status: "error", message: "Só a conta mestre faz isso." };
  }
  const slug = String(formData.get("tenant") ?? "");
  if (!isRegisteredSlug(slug)) {
    return { status: "error", message: "Serventia desconhecida." };
  }
  const mode = String(formData.get("analise") ?? "");
  if (!isNoteReviewMode(mode)) {
    return {
      status: "error",
      message: "Escolha como as notas são analisadas.",
    };
  }
  await setAiPlatformWith(
    db,
    slug,
    {
      aiAllowed: String(formData.get("ia") ?? "") !== "suspensa",
      noteReview: mode,
      reason: String(formData.get("motivo") ?? ""),
    },
    session.user.id,
  );
  revalidatePath("/admin/atrios/assistente-virtual");
  return { status: "saved", message: "Salvo. Já vale para a serventia." };
}
