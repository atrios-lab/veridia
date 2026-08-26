"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { user as userTable } from "@/db/auth-schema.ts";
import { db } from "@/db/index.ts";
import { recordAudit } from "@/lib/audit.ts";
import { auth } from "@/lib/auth.ts";
import { deleteEmailChangesWith, resolveOrigin } from "@/lib/auth-tokens.ts";
import { sendEmailChangedNotice } from "@/lib/email/index.ts";
import { getTenant } from "@/lib/tenant.ts";
import { findEmailChange } from "./find-email-change.ts";

const PAGE = "/admin/confirmar-email";

/**
 * Applies the change the link stands for. A button and not the page load:
 * a mail scanner that follows links would otherwise complete the one step
 * this whole flow exists to make a person take.
 */
export async function confirmEmailChange(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const tenant = await getTenant();
  const pending = token ? await findEmailChange(token, tenant.slug) : null;
  if (!pending) redirect(PAGE);

  const ctx = await auth.$context;

  // Checked again, here, and not only when the change was asked for: up to
  // 48 hours have passed, the index is platform-wide, and the address may
  // have been taken by another invite since. Without this the UPDATE below
  // would hit the unique index and turn into a 500 on a public page.
  const taken = await ctx.internalAdapter.findUserByEmail(pending.email);
  if (taken) redirect(`${PAGE}?token=${token}&erro=indisponivel`);

  await db
    .update(userTable)
    // `emailVerified` stays true: the address was just proven by this very
    // link, and no other path in the panel knows how to clear the flag.
    .set({ email: pending.email, emailVerified: true })
    .where(eq(userTable.id, pending.userId));

  await deleteEmailChangesWith(ctx, pending.userId);

  await recordAudit({
    tenantSlug: tenant.slug,
    // No session here: the person confirming is the account itself, same as
    // acceptInvite records for a first access.
    actorId: pending.userId,
    action: "user.email-changed",
    targetType: "user",
    targetId: pending.userId,
  });

  // After the write, and never blocking it: this is the only signal the
  // person gets if the change was not theirs, but the change is already
  // correct and confirmed, so a provider refusing the notice is not a
  // reason to undo it or to show the confirmer an error.
  try {
    const origin = resolveOrigin(await headers());
    await sendEmailChangedNotice({
      to: pending.previousEmail,
      recipientName: pending.name,
      newEmail: pending.email,
      actionUrl: `${origin}/admin/login`,
      tenant,
    });
  } catch (error) {
    console.error("usuarios.email-changed-notice", error);
  }

  redirect(`${PAGE}?ok=1`);
}
