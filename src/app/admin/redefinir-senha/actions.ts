"use server";

import { APIError } from "better-auth/api";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { canAccessTenant } from "@/core/auth/roles.ts";
import {
  account as accountTable,
  user as userTable,
  verification as verificationTable,
} from "@/db/auth-schema.ts";
import { db } from "@/db/index.ts";
import { recordAudit } from "@/lib/audit.ts";
import { auth } from "@/lib/auth.ts";
import { getTenant } from "@/lib/tenant.ts";

export async function acceptInvite(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!token) redirect("/admin/redefinir-senha");
  if (password !== confirmPassword) {
    redirect(`/admin/redefinir-senha?token=${token}&erro=1`);
  }

  // Read the account behind the token before consuming it: resetPassword's
  // own response carries no email on purpose (so it can't be used to check
  // whether a token belongs to a real account), and signing the person in
  // right after ("cria a senha e já entra") needs one.
  const [row] = await db
    .select({ userId: verificationTable.value })
    .from(verificationTable)
    .where(eq(verificationTable.identifier, `reset-password:${token}`));
  if (!row) redirect("/admin/redefinir-senha");

  const [invitedUser] = await db
    .select({ email: userTable.email })
    .from(userTable)
    .where(eq(userTable.id, row.userId));
  if (!invitedUser) redirect("/admin/redefinir-senha");

  // Read before resetPassword changes it: whether this account already had
  // a credential decides which audit verb is true — "primeiro acesso" for a
  // conta convidada that never had one, "nova senha" for a returning one.
  const [existingCredential] = await db
    .select({ id: accountTable.id })
    .from(accountTable)
    .where(
      and(
        eq(accountTable.userId, row.userId),
        eq(accountTable.providerId, "credential"),
      ),
    );
  const wasFirstAccess = !existingCredential;

  const requestHeaders = await headers();
  try {
    await auth.api.resetPassword({
      body: { token, newPassword: password },
      headers: requestHeaders,
    });
  } catch (error) {
    // Consuming can fail here too (expired between render and submit, or
    // used twice), same expired screen either way, nothing to add.
    if (error instanceof APIError) redirect("/admin/redefinir-senha");
    throw error;
  }

  const tenant = await getTenant();
  await recordAudit({
    tenantSlug: tenant.slug,
    actorId: row.userId,
    action: wasFirstAccess ? "session.first-access" : "user.password-changed",
    targetType: "user",
    targetId: row.userId,
  });

  const result = await auth.api.signInEmail({
    body: { email: invitedUser.email, password },
    headers: requestHeaders,
  });

  // Same guard as the regular sign-in: the password is now set, but a link
  // opened on the wrong office's domain still may not enter that office.
  if (!canAccessTenant(result.user.tenantSlug, tenant.slug)) {
    await auth.api.signOut({ headers: requestHeaders });
    redirect("/admin/login?erro=1");
  }

  redirect("/admin");
}
