"use server";

import { and, count, eq, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  CreateAccountSchema,
  UpdateAccountSchema,
} from "@/core/auth/account.ts";
import { inviteEmailKind } from "@/core/auth/invite.ts";
import { can, isLastActiveAdmin, type Role } from "@/core/auth/roles.ts";
import {
  account as accountTable,
  session as sessionTable,
  user as userTable,
} from "@/db/auth-schema.ts";
import { db } from "@/db/index.ts";
import { recordAudit } from "@/lib/audit.ts";
import { auth } from "@/lib/auth.ts";
import {
  buildConfirmEmailUrl,
  buildResetPasswordUrl,
  deleteEmailChangesWith,
  deleteResetTokensWith,
  issueEmailChangeTokenWith,
  issueResetTokenWith,
  resolveOrigin,
} from "@/lib/auth-tokens.ts";
import { AddressDoesNotReceiveError } from "@/lib/email/bounces.ts";
import {
  sendEmailChangeEmail,
  sendInviteEmail,
  sendPasswordResetEmail,
} from "@/lib/email/index.ts";
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
    kind: inviteEmailKind(session.user.role ?? ""),
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
 * shared guard for every action below, so none can be pointed at another
 * office's account by a forged `userId`.
 *
 * `credentialId` is the same join `listAccounts` uses for the "Aguardando 1º
 * acesso" badge: a row exists only once the person has set their own
 * password, so its absence is "never entered the panel", which is the one
 * state deleteAccount is allowed to act on.
 */
async function findOwnAccount(userId: string, tenantSlug: string) {
  const [row] = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      role: userTable.role,
      credentialId: accountTable.id,
    })
    .from(userTable)
    .leftJoin(
      accountTable,
      and(
        eq(accountTable.userId, userTable.id),
        eq(accountTable.providerId, "credential"),
      ),
    )
    .where(and(eq(userTable.id, userId), eq(userTable.tenantSlug, tenantSlug)));
  return row ?? null;
}

/**
 * How many *other* Registrador accounts in the office still have access.
 * The target is excluded because it is the one about to leave that count,
 * whether it is being deactivated or demoted: both are the same question.
 */
async function countOtherActiveAdmins(tenantSlug: string, exceptId: string) {
  const [{ value }] = await db
    .select({ value: count() })
    .from(userTable)
    .where(
      and(
        eq(userTable.tenantSlug, tenantSlug),
        eq(userTable.role, "admin"),
        isNull(userTable.disabledAt),
        ne(userTable.id, exceptId),
      ),
    );
  return value;
}

const LAST_ADMIN_MESSAGE =
  "É preciso manter ao menos um Registrador com acesso ativo.";

// Deliberately not "tente de novo em instantes": the two most common
// refusals (a suppressed recipient, a provider account still pending
// approval) are permanent, and inviting the operator to click again is
// inviting them to click forever. It points at the way out instead.
// The provider is not the only reason a send does not happen. When the
// address itself already told us it does not take mail, saying "o provedor
// não aceitou o envio" sends the registrador to check a provider that is
// working fine, and hides the one fact that would fix it.
function sendFailureMessage(error: unknown, fallback: string): string {
  if (error instanceof AddressDoesNotReceiveError) {
    return `${error.email} não recebe mensagens: ${
      error.detail || "a última mensagem voltou"
    }. Atualize o e-mail da conta.`;
  }
  return fallback;
}

const SEND_FAILED_MESSAGE =
  "O provedor de e-mail não aceitou o envio. Copie o link e entregue à pessoa.";

// No "copie o link" here: the confirmation has to reach the address being
// claimed, and handing that link to whoever asked for the change would skip
// the only proof this flow exists to collect.
const SEND_FAILED_MESSAGE_EMAIL_CHANGE =
  "O nome e o papel foram salvos, mas o provedor de e-mail não aceitou o envio da confirmação. O e-mail da conta segue o mesmo.";

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
      kind: inviteEmailKind(session.user.role ?? ""),
    });
  } catch (error) {
    // The provider's answer carries the reason (a suppressed recipient, an
    // unapproved account) and the recipient's address with it: it goes to
    // the server log, where support looks, and never to the screen.
    console.error("usuarios.resend-invite", error);
    return {
      status: "error",
      message: sendFailureMessage(error, SEND_FAILED_MESSAGE),
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
  } catch (error) {
    console.error("usuarios.password-reset", error);
    return {
      status: "error",
      message: sendFailureMessage(error, SEND_FAILED_MESSAGE),
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

  const otherActiveAdmins = await countOtherActiveAdmins(
    tenant.slug,
    target.id,
  );
  if (isLastActiveAdmin(target.role, otherActiveAdmins)) {
    return { status: "error", message: LAST_ADMIN_MESSAGE };
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

export type UpdateAccountValues = {
  name: string;
  email: string;
  role: string;
};

export type UpdateAccountState =
  | { status: "idle" }
  | { status: "saved" }
  // Saved, and an e-mail change is now waiting on the person at that
  // address: the screen has to say so, or the registrador walks away
  // thinking the login already changed.
  | { status: "saved-pending-email"; email: string }
  | {
      status: "error";
      message: string;
      fieldErrors: Record<string, string>;
      // Echoed back for the same reason as createUser's: the dialog's form
      // is uncontrolled, and React resets it once the action resolves.
      values: UpdateAccountValues;
    };

/**
 * Corrects the name and the role of an account that already exists. The
 * e-mail is not here: it is also the login, so changing it needs a
 * confirmation round trip that this action deliberately does not attempt.
 */
export async function updateAccount(
  _previous: UpdateAccountState,
  formData: FormData,
): Promise<UpdateAccountState> {
  const userId = String(formData.get("userId") ?? "");
  const values: UpdateAccountValues = {
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
    role: String(formData.get("role") ?? ""),
  };

  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "user.manage")) notFound();

  const parsed = UpdateAccountSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path.at(-1) ?? "");
      fieldErrors[field] ??= issue.message;
    }
    return {
      status: "error",
      message: "Confira os campos destacados.",
      fieldErrors,
      values,
    };
  }

  const tenant = await getTenant();
  const target = await findOwnAccount(userId, tenant.slug);
  if (!target) notFound();

  // Demoting is the same question deactivating asks: would the office be
  // left with nobody holding `user.manage`? Only a Registrador losing the
  // role can trip it, so the count is skipped for every other edit.
  if (target.role === "admin" && parsed.data.role !== "admin") {
    const otherActiveAdmins = await countOtherActiveAdmins(
      tenant.slug,
      target.id,
    );
    if (isLastActiveAdmin(target.role, otherActiveAdmins)) {
      return {
        status: "error",
        message: LAST_ADMIN_MESSAGE,
        fieldErrors: {},
        values,
      };
    }
  }

  // The e-mail is not written here even when it changes: it is the login,
  // and a typo would take the account with it. What gets written is a
  // pending change, confirmed by whoever reaches the new address.
  const wantsNewEmail = parsed.data.email !== target.email;
  const ctx = await auth.$context;

  if (wantsNewEmail) {
    // Unique platform-wide, same check createUser makes: the database's own
    // index would refuse it anyway, and an explanation beats a crash.
    const taken = await ctx.internalAdapter.findUserByEmail(parsed.data.email);
    if (taken) {
      return {
        status: "error",
        message: "Confira os campos destacados.",
        fieldErrors: { email: "Já existe uma conta com esse e-mail." },
        values,
      };
    }
  }

  await db
    .update(userTable)
    .set({ name: parsed.data.name, role: parsed.data.role })
    .where(eq(userTable.id, target.id));

  await recordAudit({
    tenantSlug: tenant.slug,
    actorId: session.user.id,
    action: "user.update",
    targetType: "user",
    targetId: target.id,
  });

  if (!wantsNewEmail) {
    revalidatePath(USERS_PATH);
    return { status: "saved" };
  }

  const token = await issueEmailChangeTokenWith(
    ctx,
    target.id,
    parsed.data.email,
  );
  const requestHeaders = await headers();

  try {
    await sendEmailChangeEmail({
      to: parsed.data.email,
      recipientName: parsed.data.name,
      currentEmail: target.email,
      actionUrl: buildConfirmEmailUrl(resolveOrigin(requestHeaders), token),
      tenant,
    });
  } catch (error) {
    console.error("usuarios.email-change", error);
    // Drop the pending change: a request nobody can confirm is worse than
    // no request, because the list would advertise a change that can never
    // land. The name and role above stay saved, they did not depend on it.
    await deleteEmailChangesWith(ctx, target.id);
    return {
      status: "error",
      message: sendFailureMessage(error, SEND_FAILED_MESSAGE_EMAIL_CHANGE),
      fieldErrors: {},
      values,
    };
  }

  await recordAudit({
    tenantSlug: tenant.slug,
    actorId: session.user.id,
    action: "user.email-change-requested",
    targetType: "user",
    targetId: target.id,
  });

  revalidatePath(USERS_PATH);
  return { status: "saved-pending-email", email: parsed.data.email };
}

export type ResetLinkState =
  | { status: "idle" }
  | { status: "ready"; url: string }
  | { status: "error"; message: string };

/**
 * The same link the e-mail would have carried, handed to the registrador
 * instead of to a mail server. It exists because the office's only channel
 * for returning access used to be an e-mail provider nobody here controls:
 * when it refuses a recipient, the person is locked out with no way back.
 *
 * Not an escalation: whoever can call this already holds `user.manage`, so
 * they could already trigger the reset, deactivate the account and create
 * another. It gets its own audit verb all the same, because "I sent her a
 * link" and "I took her link" are exactly what a trail has to tell apart.
 */
export async function createPasswordResetLink(
  _previous: ResetLinkState,
  formData: FormData,
): Promise<ResetLinkState> {
  const userId = String(formData.get("userId") ?? "");
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "user.manage")) notFound();

  const tenant = await getTenant();
  const target = await findOwnAccount(userId, tenant.slug);
  if (!target) notFound();

  const ctx = await auth.$context;
  const token = await issueResetTokenWith(ctx, target.id);
  const requestHeaders = await headers();

  await recordAudit({
    tenantSlug: tenant.slug,
    actorId: session.user.id,
    // "issued", not "copied": the clipboard is the browser's business and
    // the server never learns whether the copy happened.
    action: "user.password-reset-link-issued",
    targetType: "user",
    targetId: target.id,
  });

  return {
    status: "ready",
    url: buildResetPasswordUrl(resolveOrigin(requestHeaders), token),
  };
}

/**
 * Removes an account that never entered the panel, and with it the e-mail
 * it was holding: `user.email` is unique platform-wide, so an address
 * invited into the wrong office stays burned until the row goes.
 *
 * Only an account with no credential. One that has already worked here
 * keeps "Desativar acesso" instead: `audit_log.actorId` carries no foreign
 * key and every `authorUserId` is `on delete set null`, so deleting would
 * not break the database, it would quietly reattribute that person's acts
 * to "Sistema" and their messages to "Serventia". Attribution is the one
 * thing the trail exists to hold.
 *
 * No last-Registrador guard here, and none is missing: this only reaches an
 * account with no credential, one that has never signed in, while whoever
 * is clicking is signed in and therefore has one. The target is never the
 * caller, and an office losing a Registrador who never entered still has
 * the Registrador doing the deleting.
 */
export async function deleteAccount(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const userId = String(formData.get("userId") ?? "");
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "user.manage")) notFound();

  const tenant = await getTenant();
  const target = await findOwnAccount(userId, tenant.slug);
  if (!target) notFound();

  // Read now, not when the screen was painted: the invited person may have
  // created their password while this dialog sat open.
  if (target.credentialId !== null) {
    return {
      status: "error",
      message:
        "Esta conta já acessou o painel. Use “Desativar acesso” para tirar o acesso sem apagar o histórico.",
    };
  }

  // Tokens first: `verification` has no foreign key to `user`, so this is
  // the one row the cascade will not take. Failing here leaves an account
  // with no invite open, which "Reenviar convite" fixes; failing the other
  // way around would leave the orphan token this exists to avoid.
  const ctx = await auth.$context;
  await deleteResetTokensWith(ctx, target.id);
  await deleteEmailChangesWith(ctx, target.id);

  // `session` and `account` follow by cascade (see auth-schema.ts).
  await db.delete(userTable).where(eq(userTable.id, target.id));

  await recordAudit({
    tenantSlug: tenant.slug,
    actorId: session.user.id,
    action: "user.delete",
    targetType: "user",
    targetId: target.id,
  });

  revalidatePath(USERS_PATH);
  return { status: "sent" };
}
