"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { confirmEmailChange, sendEmailChangeCode } from "@/lib/access-code.ts";
import {
  forgetSavedComputersWith,
  setCodeEmailWith,
} from "@/lib/access-settings.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export type OwnAccessState =
  | { status: "idle" }
  | { status: "code-sent"; email: string; to: string }
  | { status: "saved"; message: string }
  | { status: "error"; message: string; email?: string };

const PATH = "/admin/minha-conta";

/**
 * Each person changes only their own: the target is always the session's
 * user, never an id from the form (decision of 10/11/2026). The
 * administrator changes anyone's in Configurações › Duas etapas.
 */
async function self() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "admin.access", session.user.permissions)
  )
    return null;
  return { session, tenant: await getTenant() };
}

const DENIED: OwnAccessState = { status: "error", message: "Sem permissão." };

/** Empty clears it at once; an address gets a code to prove it first. */
export async function requestOwnEmail(
  _previous: OwnAccessState,
  formData: FormData,
): Promise<OwnAccessState> {
  const ok = await self();
  if (!ok) return DENIED;
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) {
    await setCodeEmailWith(
      db,
      ok.tenant.slug,
      ok.session.user.id,
      undefined,
      ok.session.user.id,
    );
    revalidatePath(PATH);
    return {
      status: "saved",
      message: "Pronto: o código volta a ir para o e-mail da sua conta.",
    };
  }
  if (!z.email().safeParse(email).success) {
    return { status: "error", message: "Informe um e-mail válido.", email };
  }
  try {
    const to = await sendEmailChangeCode(
      ok.tenant,
      { id: ok.session.user.id, name: ok.session.user.name },
      email,
    );
    return { status: "code-sent", email, to };
  } catch (error) {
    console.error("minha-conta.email-code", error);
    return {
      status: "error",
      message: "Não foi possível enviar o código para esse e-mail.",
      email,
    };
  }
}

export async function confirmOwnEmail(
  _previous: OwnAccessState,
  formData: FormData,
): Promise<OwnAccessState> {
  const ok = await self();
  if (!ok) return DENIED;
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const problem = await confirmEmailChange(
    ok.session.user.id,
    email,
    String(formData.get("code") ?? ""),
  );
  if (problem) return { status: "error", message: problem, email };
  await setCodeEmailWith(
    db,
    ok.tenant.slug,
    ok.session.user.id,
    email,
    ok.session.user.id,
  );
  revalidatePath(PATH);
  return {
    status: "saved",
    message:
      "E-mail de verificação confirmado. Os próximos códigos vão para ele.",
  };
}

export async function forgetOwnComputers(
  _previous: OwnAccessState,
  _formData: FormData,
): Promise<OwnAccessState> {
  const ok = await self();
  if (!ok) return DENIED;
  await forgetSavedComputersWith(
    db,
    ok.tenant.slug,
    ok.session.user.id,
    ok.session.user.id,
  );
  revalidatePath(PATH);
  return {
    status: "saved",
    message:
      "Pronto: seus dispositivos salvos vão pedir o código no próximo acesso.",
  };
}
