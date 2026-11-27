import "server-only";
import { revalidatePath } from "next/cache";
import { decidesDeletions } from "@/core/deletion/official.ts";
import { db } from "@/db/index.ts";
import { requestDeletionWith } from "./deletion-requests.ts";
import { getSession } from "./session.ts";
import { getTenant } from "./tenant.ts";

/**
 * Every deletion of the platform waits for the Tabelião (decision of
 * 27/11/2026: "faça a aprovação para qualquer ato da plataforma"). Whoever
 * decides (the Tabelião, the super admin, or whoever he authorized in
 * Perfis e permissões) deletes at once, with the reason; anyone else sends
 * the request, and the form is replayed when it is approved.
 */

/** What the action answers when the deletion went to the Tabelião. */
export interface ApprovalAsked {
  status: "error";
  message: string;
  fieldErrors: Record<string, string>;
}

/** An "op" that undoes a deletion goes through without asking. */
const UNDO = new Set(["restore", "restaurar", "show", "unhide", "reativar"]);

function payloadOf(formData: FormData): [string, string][] {
  const out: [string, string][] = [];
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string" && !k.startsWith("$ACTION")) out.push([k, v]);
  }
  return out;
}

/**
 * Null to go on (the person decides, or nothing is being deleted); the
 * answer to give otherwise. `action`: the key in the registry of
 * autorizacoes/registry.ts; `label`: what is being deleted, in Portuguese.
 */
export async function askApproval(
  action: string,
  formData: FormData,
  label: string,
): Promise<ApprovalAsked | null> {
  if (UNDO.has(String(formData.get("op") ?? ""))) return null;
  const session = await getSession();
  if (!session) return null;
  if (decidesDeletions(session.user.role ?? "", session.user.permissions)) {
    return null;
  }
  const tenant = await getTenant();
  const targetId = String(formData.get("id") ?? "").slice(0, 200);
  try {
    await requestDeletionWith(
      db,
      tenant.slug,
      {
        kind: action,
        targetId,
        label,
        reason: String(formData.get("justificativa") ?? ""),
        payload: payloadOf(formData),
      },
      { id: session.user.id },
    );
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Não deu para pedir.",
      fieldErrors: {},
    };
  }
  revalidatePath("/admin", "layout");
  return {
    status: "error",
    message:
      "Enviado para aprovação do Tabelião, com o seu motivo. Só sai depois que ele (ou quem ele autorizou) aprovar, em Autorizações de exclusão.",
    fieldErrors: {},
  };
}
