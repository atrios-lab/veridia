"use server";

import { revalidatePath } from "next/cache";
import { decidesDeletions } from "@/core/deletion/official.ts";
import { db } from "@/db/index.ts";
import { justify } from "@/lib/audit-reason.ts";
import { decideDeletionWith } from "@/lib/deletion-requests.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export interface DecideState {
  status: "idle" | "success" | "error";
  message?: string;
}

/** The Tabelião approves or refuses a request to delete an official document. */
export async function decideDeletionAction(
  _previous: DecideState,
  formData: FormData,
): Promise<DecideState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const session = await getSession();
  if (!session || !decidesDeletions(session.user.role ?? "")) {
    return {
      status: "error",
      message: "Só o Tabelião decide a exclusão de documento oficial.",
    };
  }
  const tenant = await getTenant();
  const approve = String(formData.get("op") ?? "") === "aprovar";
  try {
    await decideDeletionWith(
      db,
      tenant.slug,
      String(formData.get("id") ?? ""),
      approve,
      String(formData.get("justificativa") ?? ""),
      { id: session.user.id },
    );
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Não deu para decidir.",
    };
  }
  revalidatePath("/admin", "layout");
  return {
    status: "success",
    message: approve
      ? "Exclusão aprovada. O documento saiu das listas e continua guardado."
      : "Exclusão recusada. O documento continua como estava.",
  };
}
