"use server";

import { and, eq, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { user as userTable } from "@/db/auth-schema.ts";
import { db } from "@/db/index.ts";
import { recordAudit } from "@/lib/audit.ts";
import { auth } from "@/lib/auth.ts";
import {
  buildResetPasswordUrl,
  issueResetTokenWith,
  resolveOrigin,
} from "@/lib/auth-tokens.ts";
import { sendPasswordResetEmail } from "@/lib/email/index.ts";
import { isRateLimited } from "@/lib/rate-limit.ts";
import { getTenant } from "@/lib/tenant.ts";

/**
 * The link a person asks for themselves, from the login screen. Same token,
 * same e-mail and same "criar nova senha" page as the one a registrador
 * sends from Usuários: the only new thing here is that nobody has to be
 * asked, and that this endpoint answers to whoever types into it.
 *
 * Which is why every outcome ends at the same neutral screen. An account
 * that exists, one that never did, one that was deactivated and one that
 * belongs to another office all get the same sentence, for the same reason
 * `signIn` gives one generic error for every failure: a recovery form that
 * distinguishes them is a directory of who works at the serventia, and this
 * one, unlike the login, does not even ask for a password to be tried.
 */
export async function requestPasswordReset(formData: FormData) {
  const requestHeaders = await headers();
  if (await isRateLimited(requestHeaders)) {
    redirect("/admin/esqueci-senha?erro=limite");
  }

  // Same normalization createUser applies when the account is filed, so a
  // pasted address with a capital or a trailing space still matches.
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const tenant = await getTenant();

  // The three conditions that decide it, in one query. Deactivated is the one
  // that matters most: an account someone was removed from must not be
  // recoverable through an anonymous form.
  const [target] = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
    })
    .from(userTable)
    .where(
      and(
        eq(userTable.email, email),
        eq(userTable.tenantSlug, tenant.slug),
        isNull(userTable.disabledAt),
      ),
    );

  if (target) {
    const ctx = await auth.$context;
    const token = await issueResetTokenWith(ctx, target.id);
    const actionUrl = buildResetPasswordUrl(
      resolveOrigin(requestHeaders),
      token,
    );
    try {
      await sendPasswordResetEmail({
        to: target.email,
        recipientName: target.name,
        actionUrl,
        tenant,
      });
      // Actor and target are the same person here, which is the whole
      // difference from `user.password-reset-request` next door, where the
      // actor is the registrador. Written only after the e-mail actually
      // left: an address nobody has an account for leaves no trace at all.
      await recordAudit({
        tenantSlug: tenant.slug,
        actorId: target.id,
        action: "user.password-reset-self-request",
        targetType: "user",
        targetId: target.id,
      });
    } catch (error) {
      // The screen says the same thing either way, so there is nothing to
      // tell the visitor: telling them the send failed would confirm the
      // account exists.
      console.error("admin.password-reset-self", error);
    }
  }

  redirect("/admin/esqueci-senha?enviado=1");
}
