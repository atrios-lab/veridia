"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import { isRegisteredSlug } from "@/core/tenant/resolve.ts";
import { db } from "@/db/index.ts";
import { setMonthlyLimitWith } from "@/lib/dpo/store.ts";
import { getSession } from "@/lib/session.ts";

export type LimitState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

/** Sets one office's monthly ceiling; empty goes back to the default. */
export async function setDpoLimit(
  _previous: LimitState,
  formData: FormData,
): Promise<LimitState> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "dpo.oversee", session.user.permissions)
  ) {
    return { status: "error", message: "Só a conta mestre faz isso." };
  }
  const slug = String(formData.get("tenant") ?? "");
  if (!isRegisteredSlug(slug)) {
    return { status: "error", message: "Serventia desconhecida." };
  }
  const raw = String(formData.get("limit") ?? "").trim();
  const limit = raw === "" ? null : Number(raw);
  if (
    limit !== null &&
    (!Number.isInteger(limit) || limit < 1 || limit > 100_000)
  ) {
    return {
      status: "error",
      message:
        "Informe um número inteiro entre 1 e 100.000, ou deixe vazio para o padrão.",
    };
  }
  await setMonthlyLimitWith(db, {
    tenantSlug: slug,
    limit,
    actorId: session.user.id,
  });
  revalidatePath("/admin/atrios/assistente-dpo");
  return { status: "saved", message: "Teto mensal salvo." };
}
