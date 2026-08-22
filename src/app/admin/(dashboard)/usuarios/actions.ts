"use server";

import { and, count, eq, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { CreateAccountSchema } from "@/core/auth/account.ts";
import { can, isLastActiveAdmin, type Role } from "@/core/auth/roles.ts";
import {
  session as sessionTable,
  user as userTable,
} from "@/db/auth-schema.ts";
import { db } from "@/db/index.ts";
import { recordAudit } from "@/lib/audit.ts";
import { auth } from "@/lib/auth.ts";
import {
  buildResetPasswordUrl,
  issueResetTokenWith,
  resolveOrigin,
} from "@/lib/auth-tokens.ts";
import { sendInviteEmail, sendPasswordResetEmail } from "@/lib/email/index.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { ROLE_LABELS } from "../../_components/role-labels.ts";

const USERS_PATH = "/admin/usuarios";

export type CreateAccountValues = { name: string; email: string; role: string };

export type CreateAccountState =
  | { status: "idle" }
  | { status: "created" }
  | {
      status: "error";
      message: string;
      fieldErrors: Record<string, string>;
      // Echoed back for the same reason as saveOfficeContact: an
      // uncontrolled form loses whatever was right along with what was
      // wrong once React resets it after the action resolves.
      values: CreateAccountValues;
    };

function fail(
  message: string,
  values: CreateAccountValues,
  fieldErrors: Record<string, string> = {},
): CreateAccountState {
  return { status: "error", message, fieldErrors, values };
}

export async function createUser(
  _previous: CreateAccountState,
  formData: FormData,
): Promise<CreateAccountState> {
  const values: CreateAccountValues = {
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
    role: String(formData.get("role") ?? ""),
  };

  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "user.manage")) {
    return fail("Você não tem permissão para criar contas.", values);
  }

  const parsed = CreateAccountSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path.at(-1) ?? "");
      fieldErrors[field] ??= issue.message;
    }
    return fail("Confira os campos destacados.", values, fieldErrors);
  }

  const tenant = await getTenant();
  const ctx = await auth.$context;

  // E-mail is unique platform-wide (see auth-schema.ts), not only within
  // this serventia: the check has to match, or a forged submission could
  // still crash on the database's own unique index instead of failing here.
  const existing = await ctx.internalAdapter.findUserByEmail(parsed.data.email);
  if (existing) {
    // Same top-level phrasing as a schema failure below: the specific
    // reason already lives next to the e-mail field, so the banner does not
    // repeat it verbatim and render it twice on screen.
    return fail("Confira os campos destacados.", values, {
      email: "Já existe uma conta com esse e-mail.",
    });
  }

  const created = await ctx.internalAdapter.createUser({
    email: parsed.data.email,
    name: parsed.data.name,
    emailVerified: true,
    role: parsed.data.role,
    tenantSlug: tenant.slug,
  });

  const token = await issueResetTokenWith(ctx, created.id);
  const requestHeaders = await headers();
  const actionUrl = buildResetPasswordUrl(resolveOrigin(requestHeaders), token);

  await sendInviteEmail({
    to: created.email,
    recipientName: created.name,
    inviterName: session.user.name || session.user.email,
    roleLabel: ROLE_LABELS[parsed.data.role],
    actionUrl,
    tenant,
  });

  await recordAudit({
    tenantSlug: tenant.slug,
    actorId: session.user.id,
    action: "user.invite",
    targetType: "user",
    targetId: created.id,
  });

  revalidatePath(USERS_PATH);
  return { status: "created" };
}

/**
 * Looks up an account by id, scoped to the session's own serventia: the
 * shared guard for both actions below, so neither can be pointed at another
 * office's account by a forged `userId`.
 */
async function findOwnAccount(userId: string, tenantSlug: string) {
  const [row] = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      role: userTable.role,
    })
    .from(userTable)
    .where(and(eq(userTable.id, userId), eq(userTable.tenantSlug, tenantSlug)));
  return row ?? null;
}

// The two row actions below share this shape so the same client component
// (AccountRowActions) can drive either one through useActionState and show
// the same two feedback states: a toast on success, a toast with the
// specific reason on failure.
export type AccountActionState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "error"; message: string };

export async function resendInvite(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const userId = String(formData.get("userId") ?? "");
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "user.manage")) notFound();

  const tenant = await getTenant();
  const target = await findOwnAccount(userId, tenant.slug);
  if (!target) notFound();

  const ctx = await auth.$context;
  const token = await issueResetTokenWith(ctx, target.id);
  const requestHeaders = await headers();
  const actionUrl = buildResetPasswordUrl(resolveOrigin(requestHeaders), token);

  try {
    await sendInviteEmail({
      to: target.email,
      recipientName: target.name,
      inviterName: session.user.name || session.user.email,
      roleLabel: ROLE_LABELS[target.role as Role] ?? target.role,
      actionUrl,
      tenant,
    });
  } catch {
    return {
      status: "error",
      message:
        "Não deu para reenviar o convite agora. Tente de novo em instantes.",
    };
  }

  await recordAudit({
    tenantSlug: tenant.slug,
    actorId: session.user.id,
    action: "user.invite-resend",
    targetType: "user",
    targetId: target.id,
  });

  revalidatePath(USERS_PATH);
  return { status: "sent" };
}

export async function triggerPasswordReset(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const userId = String(formData.get("userId") ?? "");
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "user.manage")) notFound();

  const tenant = await getTenant();
  const target = await findOwnAccount(userId, tenant.slug);
  if (!target) notFound();

  const ctx = await auth.$context;
  const token = await issueResetTokenWith(ctx, target.id);
  const requestHeaders = await headers();
  const actionUrl = buildResetPasswordUrl(resolveOrigin(requestHeaders), token);

  try {
    await sendPasswordResetEmail({
      to: target.email,
      recipientName: target.name,
      actionUrl,
      tenant,
    });
  } catch {
    return {
      status: "error",
      message:
        "Não deu para enviar o link de nova senha agora. Tente de novo em instantes.",
    };
  }

  await recordAudit({
    tenantSlug: tenant.slug,
    actorId: session.user.id,
    action: "user.password-reset-request",
    targetType: "user",
    targetId: target.id,
  });

  revalidatePath(USERS_PATH);
  return { status: "sent" };
}

export async function deactivateAccount(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const userId = String(formData.get("userId") ?? "");
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "user.manage")) notFound();

  if (userId === session.user.id) {
    return {
      status: "error",
      message: "Você não pode desativar a própria conta.",
    };
  }

  const tenant = await getTenant();
  const target = await findOwnAccount(userId, tenant.slug);
  if (!target) notFound();

  // Counts the *other* active Registrador accounts in the office: the
  // target is excluded because it is the one about to leave that count.
  const [{ value: otherActiveAdmins }] = await db
    .select({ value: count() })
    .from(userTable)
    .where(
      and(
        eq(userTable.tenantSlug, tenant.slug),
        eq(userTable.role, "admin"),
        isNull(userTable.disabledAt),
        ne(userTable.id, target.id),
      ),
    );

  if (isLastActiveAdmin(target.role, otherActiveAdmins)) {
    return {
      status: "error",
      message: "É preciso manter ao menos um Registrador com acesso ativo.",
    };
  }

  await db
    .update(userTable)
    .set({ disabledAt: new Date() })
    .where(eq(userTable.id, target.id));
  // Ends every session that account already had open, not just future
  // logins: getSession() has nothing left to find on the next request.
  await db.delete(sessionTable).where(eq(sessionTable.userId, target.id));

  await recordAudit({
    tenantSlug: tenant.slug,
    actorId: session.user.id,
    action: "user.deactivate",
    targetType: "user",
    targetId: target.id,
  });

  revalidatePath(USERS_PATH);
  return { status: "sent" };
}

export async function reactivateAccount(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const userId = String(formData.get("userId") ?? "");
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "user.manage")) notFound();

  const tenant = await getTenant();
  const target = await findOwnAccount(userId, tenant.slug);
  if (!target) notFound();

  // No new invite or password link: the one the account already had before
  // being deactivated keeps working, same as design.md settled on.
  await db
    .update(userTable)
    .set({ disabledAt: null })
    .where(eq(userTable.id, target.id));

  await recordAudit({
    tenantSlug: tenant.slug,
    actorId: session.user.id,
    action: "user.reactivate",
    targetType: "user",
    targetId: target.id,
  });

  revalidatePath(USERS_PATH);
  return { status: "sent" };
}
