"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import {
  forgetSavedComputersWith,
  officeAccountsWith,
  setCodeEmailWith,
} from "@/lib/access-settings.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export type AccessState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

const PATH = "/admin/configuracoes/duas-etapas";

async function authorize(formData: FormData) {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "user.manage", session.user.permissions)
  )
    return null;
  const tenant = await getTenant();
  const userId = String(formData.get("userId") ?? "");
  // Only an account of this office.
  const accounts = await officeAccountsWith(db, tenant.slug);
  if (!accounts.some((account) => account.id === userId)) return null;
  return { session, tenant, userId };
}

const NO_PERMISSION: AccessState = {
  status: "error",
  message: "Só o administrador da serventia altera estes dados.",
};

/** Saves (or, empty, clears) where this person's access code goes. */
export async function saveCodeEmail(
  _previous: AccessState,
  formData: FormData,
): Promise<AccessState> {
  const ok = await authorize(formData);
  if (!ok) return NO_PERMISSION;
  const typed = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (typed && !z.email().safeParse(typed).success) {
    return { status: "error", message: "Informe um e-mail válido." };
  }
  await setCodeEmailWith(
    db,
    ok.tenant.slug,
    ok.userId,
    typed || undefined,
    ok.session.user.id,
  );
  revalidatePath(PATH);
  return {
    status: "saved",
    message: typed
      ? "E-mail de verificação salvo."
      : "E-mail de verificação apagado: o código volta a ir para o e-mail da conta.",
  };
}

/** Every computer this person saved asks for the code again. */
export async function forgetComputers(
  _previous: AccessState,
  formData: FormData,
): Promise<AccessState> {
  const ok = await authorize(formData);
  if (!ok) return NO_PERMISSION;
  await forgetSavedComputersWith(
    db,
    ok.tenant.slug,
    ok.userId,
    ok.session.user.id,
  );
  revalidatePath(PATH);
  return {
    status: "saved",
    message:
      "Pronto: os dispositivos salvos dessa pessoa vão pedir o código de novo.",
  };
}
