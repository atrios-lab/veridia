"use server";

import { redirect } from "next/navigation";
import { confirmAccessCode, sendAccessCode } from "@/lib/access-code.ts";
import { recordAudit } from "@/lib/audit.ts";
import { getPendingSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export type AccessCodeState =
  | { status: "idle" }
  | { status: "sent"; to: string }
  | { status: "error"; message: string };

const safeNext = (next: string) =>
  next.startsWith("/admin/") || next === "/admin" ? next : "/admin";

export async function sendAccessCodeAction(
  _previous: AccessCodeState,
  _formData: FormData,
): Promise<AccessCodeState> {
  const pending = await getPendingSession();
  if (!pending) redirect("/admin/login");
  const tenant = await getTenant();
  try {
    const to = await sendAccessCode(tenant, {
      session: pending.session,
      user: pending.user,
    });
    return { status: "sent", to };
  } catch (error) {
    console.error("acesso.code", error);
    return {
      status: "error",
      message:
        "Não foi possível enviar o código agora. Tente de novo em instantes.",
    };
  }
}

export async function confirmAccessCodeAction(
  _previous: AccessCodeState,
  formData: FormData,
): Promise<AccessCodeState> {
  const pending = await getPendingSession();
  if (!pending) redirect("/admin/login");
  const problem = await confirmAccessCode(
    { session: pending.session, user: pending.user },
    String(formData.get("code") ?? ""),
    formData.get("salvar") === "on",
  );
  if (problem) return { status: "error", message: problem };
  const tenant = await getTenant();
  await recordAudit({
    tenantSlug: tenant.slug,
    actorId: pending.user.id,
    action: "session.access-code",
    targetType: "user",
    targetId: pending.user.id,
  });
  redirect(safeNext(String(formData.get("next") ?? "/admin")));
}
