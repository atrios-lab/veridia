"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import { deactivateServiceRequests } from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export type BulkActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

const NO_PERMISSION = "Você não tem permissão para alterar estes pedidos.";
const GENERIC_ERROR =
  "Não foi possível salvar agora. Tente novamente em instantes.";

export async function deactivateServiceRequestsAction(
  _previous: BulkActionState,
  formData: FormData,
): Promise<BulkActionState> {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "requests.manage")) {
    return { status: "error", message: NO_PERMISSION };
  }

  const ids = formData.getAll("requestIds").map(String).filter(Boolean);
  if (ids.length === 0) {
    return { status: "error", message: "Selecione ao menos um protocolo." };
  }

  const tenant = await getTenant();
  try {
    await deactivateServiceRequests(tenant.slug, ids, session.user.id);
  } catch (error) {
    console.error("pedidos.deactivate-bulk", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath("/admin", "layout");
  return { status: "success" };
}
