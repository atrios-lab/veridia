"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { fichaFields } from "@/core/rcpn/ficha.ts";
import { currentJustification, justify } from "@/lib/audit-reason.ts";
import { isRcpnKind } from "@/lib/rcpn-certidao.ts";
import { FichaError, ficha } from "@/lib/rcpn-ficha.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export type FichaState =
  | { status: "idle" }
  | { status: "error"; message: string };

const NO_PERMISSION =
  "Você não tem permissão para alterar, cancelar ou estornar registros do Registro Civil.";

async function access() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "rcpn.edit", session.user.permissions)
  ) {
    return undefined;
  }
  const tenant = await getTenant();
  if (!tenant.attributions.includes("RCPN")) return undefined;
  return { session, tenant };
}

const text = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "");

const fichaPath = (id: string) => `/admin/rcpn/registro/${id}`;

/** The correction of the ficha: every field of the kind, and the reason. */
export async function saveFichaAction(
  _previous: FichaState,
  formData: FormData,
): Promise<FichaState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const id = text(formData, "id");
  const kind = text(formData, "tipo");
  if (!isRcpnKind(kind)) {
    return { status: "error", message: "Registro não encontrado." };
  }
  const values: Record<string, string> = {};
  for (const field of fichaFields(kind)) {
    const value = formData.get(field.key);
    if (value !== null) values[field.key] = String(value);
  }
  let changed = 0;
  try {
    changed = await ficha.save(
      ok.tenant.slug,
      id,
      values,
      ok.session.user.id,
      currentJustification() ?? "",
    );
  } catch (error) {
    if (error instanceof FichaError) {
      return { status: "error", message: error.message };
    }
    console.error("rcpn.ficha.save", error);
    return {
      status: "error",
      message: "Não foi possível salvar agora. Nada foi alterado.",
    };
  }
  revalidatePath("/admin/rcpn");
  redirect(`${fichaPath(id)}?alterados=${changed}`);
}

async function mark(
  formData: FormData,
  act: "cancel" | "restore",
): Promise<FichaState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const id = text(formData, "id");
  try {
    await ficha[act](
      ok.tenant.slug,
      id,
      ok.session.user.id,
      currentJustification() ?? "",
    );
  } catch (error) {
    if (error instanceof FichaError) {
      return { status: "error", message: error.message };
    }
    console.error(`rcpn.ficha.${act}`, error);
    return { status: "error", message: "Não foi possível concluir agora." };
  }
  revalidatePath("/admin/rcpn");
  redirect(
    `${fichaPath(id)}?${act === "cancel" ? "cancelado" : "estornado"}=1`,
  );
}

export async function cancelRecordAction(
  _previous: FichaState,
  formData: FormData,
): Promise<FichaState> {
  return mark(formData, "cancel");
}

export async function restoreRecordAction(
  _previous: FichaState,
  formData: FormData,
): Promise<FichaState> {
  return mark(formData, "restore");
}
