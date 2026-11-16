"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import {
  isPlatformScope,
  platformChange,
  scopeTargets,
} from "@/core/qualificacao/revisao-base.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import { db } from "@/db/index.ts";
import { setAiPlatformWith } from "@/lib/ai-platform.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export type PlatformState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

/**
 * The Assistente Virtual of the offices chosen (decision of 16/11/2026):
 * this portal's office, every office, or a selection; only what was marked
 * changes. Takes effect at once and can be changed back at any moment.
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
  const scope = String(formData.get("escopo") ?? "");
  if (!isPlatformScope(scope)) {
    return { status: "error", message: "Escolha a quem aplicar." };
  }
  const current = await getTenant().catch(() => null);
  const resolved = scopeTargets(scope, {
    ...(current ? { current: current.slug } : {}),
    all: Object.keys(TENANTS),
    chosen: formData.getAll("serventia").map(String),
  });
  if ("error" in resolved) return { status: "error", message: resolved.error };
  const change = platformChange({
    changeAi: formData.get("alterarIa") === "1",
    ai: String(formData.get("ia") ?? ""),
    changeNotes: formData.get("alterarNotas") === "1",
    notes: String(formData.get("analise") ?? ""),
  });
  if ("error" in change) return { status: "error", message: change.error };
  const reason = String(formData.get("motivo") ?? "");
  for (const slug of resolved.targets) {
    await setAiPlatformWith(
      db,
      slug,
      { ...change.change, reason },
      session.user.id,
    );
  }
  revalidatePath("/admin/atrios/assistente-virtual");
  const count = resolved.targets.length;
  return {
    status: "saved",
    message:
      count === 1
        ? `Aplicado a ${TENANTS[resolved.targets[0] ?? ""]?.name ?? "1 serventia"}. Já vale.`
        : `Aplicado a ${count} serventias. Já vale.`,
  };
}
