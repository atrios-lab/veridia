"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/index.ts";
import { justify } from "@/lib/audit-reason.ts";
import { restoreRemovedWith, revertChangeWith } from "@/lib/recovery.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export interface RecoverState {
  status: "idle" | "success" | "error";
  message?: string;
}

/** Only the Átrios master account recovers. */
export async function recoverAction(
  _previous: RecoverState,
  formData: FormData,
): Promise<RecoverState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const session = await getSession();
  if (!session || session.user.role !== "superadmin") {
    return { status: "error", message: "Só o super admin recupera." };
  }
  const tenant = await getTenant();
  const reason = String(formData.get("justificativa") ?? "");
  const table = String(formData.get("table") ?? "");
  const id = String(formData.get("id") ?? "");
  try {
    if (formData.get("op") === "revert") {
      await revertChangeWith(
        db,
        tenant.slug,
        { table, id, index: Number(formData.get("index")), reason },
        { id: session.user.id },
      );
    } else {
      await restoreRemovedWith(
        db,
        tenant.slug,
        { table, id, flag: String(formData.get("flag") ?? ""), reason },
        { id: session.user.id },
      );
    }
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Não deu para recuperar.",
    };
  }
  revalidatePath("/admin", "layout");
  return {
    status: "success",
    message:
      formData.get("op") === "revert"
        ? "Alteração desfeita. O valor anterior voltou e ficou no histórico."
        : "Recuperado. Voltou para as listas.",
  };
}
