"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import { isRegisteredSlug } from "@/core/tenant/resolve.ts";
import { db } from "@/db/index.ts";
import { setAccessPolicyWith } from "@/lib/access-policy.ts";
import { getSession } from "@/lib/session.ts";

export type ReleaseState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

/** Turns the two-step access of one office off or back on. */
export async function setTwoStep(
  _previous: ReleaseState,
  formData: FormData,
): Promise<ReleaseState> {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "access.release")) {
    return {
      status: "error",
      message: "Só a conta mestre da Átrios faz isso.",
    };
  }
  const slug = String(formData.get("tenant") ?? "");
  const twoStep = formData.get("twoStep") === "off" ? "off" : "on";
  if (!isRegisteredSlug(slug)) {
    return { status: "error", message: "Serventia desconhecida." };
  }
  await setAccessPolicyWith(
    db,
    slug,
    twoStep,
    String(formData.get("reason") ?? ""),
    session.user.id,
  );
  revalidatePath("/admin/atrios/liberacao-de-acesso");
  return {
    status: "saved",
    message:
      twoStep === "off"
        ? "Verificação em duas etapas desligada: a serventia entra só com a senha."
        : "Verificação em duas etapas ligada de novo.",
  };
}
