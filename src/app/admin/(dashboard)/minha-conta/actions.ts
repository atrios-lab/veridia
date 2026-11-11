"use server";

import { APIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import {
  confirmEmailChange,
  markAccessConfirmed,
  sendEmailChangeCode,
} from "@/lib/access-code.ts";
import {
  forgetSavedComputersWith,
  setCodeEmailWith,
} from "@/lib/access-settings.ts";
import { recordAuditWith } from "@/lib/audit.ts";
import { auth } from "@/lib/auth.ts";
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

export type PasswordState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

/** The panel's minimum (better-auth's default). */
const MIN_PASSWORD = 8;

/**
 * The person changes their own password, knowing the current one (decision
 * of 11/11/2026). Every other session of theirs ends: a password changed
 * because it leaked must not leave the leak signed in.
 */
export async function changeOwnPassword(
  _previous: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const ok = await self();
  if (!ok) return { status: "error", message: "Sem permissão." };
  const current = String(formData.get("atual") ?? "");
  const next = String(formData.get("nova") ?? "");
  const again = String(formData.get("confirmar") ?? "");
  if (!current) {
    return { status: "error", message: "Informe a senha atual." };
  }
  if (next.length < MIN_PASSWORD) {
    return {
      status: "error",
      message: `A nova senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`,
    };
  }
  if (next !== again) {
    return {
      status: "error",
      message: "A confirmação não é igual à nova senha.",
    };
  }
  if (next === current) {
    return {
      status: "error",
      message: "A nova senha precisa ser diferente da atual.",
    };
  }
  try {
    const result = await auth.api.changePassword({
      body: {
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      },
      headers: await headers(),
    });
    // The other sessions end and this one is renewed: it already passed
    // the e-mail code, so the new one counts as confirmed (lib/access-code).
    if (result.token) {
      await markAccessConfirmed(
        result.token,
        ok.session.user.id,
        new Date(Date.now() + 8 * 60 * 60 * 1000), // lib/auth.ts: eight hours
      );
    }
  } catch (error) {
    if (error instanceof APIError) {
      return {
        status: "error",
        message: "A senha atual não confere. Confira e tente de novo.",
      };
    }
    console.error("minha-conta.senha", error);
    return { status: "error", message: "Não foi possível trocar agora." };
  }
  await recordAuditWith(db, {
    tenantSlug: ok.tenant.slug,
    actorId: ok.session.user.id,
    action: "user.password-changed",
    targetType: "user",
    targetId: ok.session.user.id,
  });
  // A fresh request, so the page is drawn with the renewed session (the
  // one this request carried no longer exists).
  redirect("/admin/minha-conta?senha=trocada#senha");
}
