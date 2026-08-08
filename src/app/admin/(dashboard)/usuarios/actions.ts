"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { CreateAccountSchema } from "@/core/auth/account.ts";
import { can, type Role } from "@/core/auth/roles.ts";
import { user as userTable } from "@/db/auth-schema.ts";
import { db } from "@/db/index.ts";
import { recordAudit } from "@/lib/audit.ts";
import { auth } from "@/lib/auth.ts";
import {
  buildResetPasswordUrl,
  issueResetTokenWith,
} from "@/lib/auth-tokens.ts";
import { sendInviteEmail, sendPasswordResetEmail } from "@/lib/email/index.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { ROLE_LABELS } from "../../_components/role-labels.ts";

const USERS_PATH = "/admin/usuarios";

/** Same-origin URL an e-mail's button sends the recipient back to. */
function resolveOrigin(requestHeaders: Headers): string {
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const proto = process.env.NODE_ENV === "production" ? "https" : "http";
  return `${proto}://${host}`;
}

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
  // this serventia — the check has to match, or a forged submission could
  // still crash on the database's own unique index instead of failing here.
  const existing = await ctx.internalAdapter.findUserByEmail(parsed.data.email);
  if (existing) {
    return fail("Já existe uma conta com esse e-mail.", values, {
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
 * Looks up an account by id, scoped to the session's own serventia — the
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

export async function resendInvite(formData: FormData): Promise<void> {
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

  await sendInviteEmail({
    to: target.email,
    recipientName: target.name,
    inviterName: session.user.name || session.user.email,
    roleLabel: ROLE_LABELS[target.role as Role] ?? target.role,
    actionUrl,
    tenant,
  });

  await recordAudit({
    tenantSlug: tenant.slug,
    actorId: session.user.id,
    action: "user.invite-resend",
    targetType: "user",
    targetId: target.id,
  });

  revalidatePath(USERS_PATH);
}

export async function triggerPasswordReset(formData: FormData): Promise<void> {
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

  await sendPasswordResetEmail({
    to: target.email,
    recipientName: target.name,
    actionUrl,
    tenant,
  });

  await recordAudit({
    tenantSlug: tenant.slug,
    actorId: session.user.id,
    action: "user.password-reset-request",
    targetType: "user",
    targetId: target.id,
  });

  revalidatePath(USERS_PATH);
}
