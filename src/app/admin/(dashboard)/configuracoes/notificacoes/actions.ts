"use server";

import { revalidatePath } from "next/cache";
import { OfficeAlertsSchema } from "@/core/alerts/office.ts";
import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { saveOfficeAlertsWith } from "@/lib/office-alerts.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export type OfficeAlertsState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; message: string };

/**
 * The office's notification choices, channel by channel. The whole set
 * travels as one JSON field and the schema is the boundary.
 */
export async function saveOfficeAlerts(
  _previous: OfficeAlertsState,
  formData: FormData,
): Promise<OfficeAlertsState> {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "content.edit")) {
    return {
      status: "error",
      message: "Você não tem permissão para alterar as notificações.",
    };
  }
  const tenant = await getTenant();

  let submitted: unknown;
  try {
    submitted = JSON.parse(String(formData.get("alerts") ?? "null"));
  } catch {
    submitted = null;
  }
  const parsed = OfficeAlertsSchema.safeParse(submitted);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Não foi possível ler as opções. Recarregue a página.",
    };
  }
  try {
    await saveOfficeAlertsWith(db, tenant.slug, parsed.data, session.user.id);
  } catch (error) {
    console.error("notificacoes.save", error);
    return {
      status: "error",
      message: "Não foi possível salvar agora. Tente novamente.",
    };
  }
  // Every panel screen reads the choices in the dashboard layout.
  revalidatePath("/admin", "layout");
  return { status: "saved" };
}
