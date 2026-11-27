"use server";

import { revalidatePath } from "next/cache";
import { decidesDeletions } from "@/core/deletion/official.ts";
import { db } from "@/db/index.ts";
import { justify } from "@/lib/audit-reason.ts";
import { decideDeletionWith } from "@/lib/deletion-requests.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { APPROVABLE } from "./registry.ts";

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
  if (
    !session ||
    !decidesDeletions(session.user.role ?? "", session.user.permissions)
  ) {
    return {
      status: "error",
      message:
        "Só o Tabelião, ou quem ele autorizou em Perfis e permissões, decide a exclusão.",
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
      async (row) => {
        const entry = APPROVABLE[row.kind];
        if (!entry) throw new Error("Este tipo de exclusão não existe mais.");
        const form = new FormData();
        for (const [k, v] of row.payload ?? []) form.append(k, v);
        let result: unknown;
        try {
          result = await entry.run({ status: "idle" }, form);
        } catch (error) {
          // A redirect at the end of the action means it was done.
          const digest = (error as { digest?: unknown })?.digest;
          if (
            typeof digest === "string" &&
            digest.startsWith("NEXT_REDIRECT")
          ) {
            return;
          }
          throw error;
        }
        const r = result as { status?: string; message?: string } | undefined;
        if (r?.status === "error") {
          throw new Error(r.message || "A exclusão não pôde ser feita.");
        }
      },
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
      ? "Exclusão aprovada e feita. O item saiu das listas e continua guardado (o super admin pode recuperar)."
      : "Exclusão recusada. O documento continua como estava.",
  };
}
