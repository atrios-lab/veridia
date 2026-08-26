// No "server-only" guard, and no static import of ./auth.ts: this file is
// imported directly by src/lib/auth-tokens.test.ts under plain
// `node --test`, and auth.ts throws at import time when
// BETTER_AUTH_SECRET is unset (as it is for a unit test). Callers already
// hold a `ctx` (from `await auth.$context`) for their own reasons: see
// usuarios/actions.ts and scripts/invite-admin.ts, and pass it in, the
// same way session-revocation.test.ts and invite.test.ts build their own
// auth instance rather than reaching for the app's singleton.
import { randomBytes } from "node:crypto";
import { requestHost } from "./request-host.ts";

const RESET_TOKEN_PREFIX = "reset-password:";
const CHANGE_EMAIL_PREFIX = "change-email:";

// An e-mail change needs two things in `verification.value`, a single text
// column: whose account, and which address. The user id goes first because
// the adapter offers only `eq` and `starts_with`, and with that order one
// `starts_with userId` finds every pending change for an account, which is
// what "asking again replaces the last one" needs. `|` cannot appear in a
// valid address, so reading cuts at the first one.
const VALUE_SEPARATOR = "|";

/**
 * Only the slice of the better-auth context this function touches. Not the
 * library's own `AuthContext<Options>`: that type carries the exact literal
 * `Options` an instance was built with, so the app's `auth` and a test's
 * smaller local instance, same shape, different literal options, are not
 * assignable to one shared alias of it. This one is structural on purpose,
 * so either satisfies it.
 */
interface ResetTokenAuthContext {
  adapter: {
    deleteMany: (data: {
      model: string;
      where: Array<{
        field: string;
        value: string;
        operator?: "eq" | "starts_with";
      }>;
    }) => Promise<number>;
  };
  internalAdapter: {
    createVerificationValue: (data: {
      identifier: string;
      value: string;
      expiresAt: Date;
    }) => Promise<unknown>;
  };
  options: {
    emailAndPassword?: { resetPasswordTokenExpiresIn?: number };
  };
}

/**
 * Records that an account asked to move to `newEmail`, replacing whatever
 * change it had pending. Nothing is written to `user` here: the address only
 * becomes the account's own once the link sent to it is opened, which is the
 * whole point, a mistyped address never gets to be the login.
 *
 * Its own prefix, not `reset-password:`: issuing a new password must not
 * cancel a pending e-mail change, nor the other way round.
 */
export async function issueEmailChangeTokenWith(
  ctx: ResetTokenAuthContext,
  userId: string,
  newEmail: string,
): Promise<string> {
  await deleteEmailChangesWith(ctx, userId);

  const expiresInSeconds =
    ctx.options.emailAndPassword?.resetPasswordTokenExpiresIn ?? 3600;
  const token = randomBytes(24).toString("base64url");

  await ctx.internalAdapter.createVerificationValue({
    identifier: `${CHANGE_EMAIL_PREFIX}${token}`,
    value: `${userId}${VALUE_SEPARATOR}${newEmail}`,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
  });

  return token;
}

/**
 * Drops every pending e-mail change for a user: on a new request, and when
 * the account is deleted. Same reason as the reset tokens below, and a
 * separate call because the two prefixes are deliberately independent.
 */
export async function deleteEmailChangesWith(
  ctx: ResetTokenAuthContext,
  userId: string,
): Promise<void> {
  await ctx.adapter.deleteMany({
    model: "verification",
    where: [
      { field: "value", operator: "starts_with", value: userId },
      {
        field: "identifier",
        operator: "starts_with",
        value: CHANGE_EMAIL_PREFIX,
      },
    ],
  });
}

/** Reads back what `issueEmailChangeTokenWith` stored, or null if malformed. */
export function parseEmailChangeValue(
  value: string,
): { userId: string; email: string } | null {
  const cut = value.indexOf(VALUE_SEPARATOR);
  if (cut <= 0) return null;
  const email = value.slice(cut + 1);
  return email ? { userId: value.slice(0, cut), email } : null;
}

/** The identifier a change-email token is stored under. */
export function emailChangeIdentifier(token: string): string {
  return `${CHANGE_EMAIL_PREFIX}${token}`;
}

/**
 * Drops every reset-password token still live for a user. Called before
 * minting a new one, so only one link is ever valid at a time, and again
 * when the account is deleted: `verification` has no foreign key to `user`
 * (it is indexed by `identifier`, not by owner), so nothing removes those
 * rows on its own.
 */
export async function deleteResetTokensWith(
  ctx: ResetTokenAuthContext,
  userId: string,
): Promise<void> {
  await ctx.adapter.deleteMany({
    model: "verification",
    where: [
      { field: "value", value: userId },
      {
        field: "identifier",
        operator: "starts_with",
        value: RESET_TOKEN_PREFIX,
      },
    ],
  });
}

/**
 * Mints a fresh 48h reset-password token for a user, first deleting any
 * reset-password token issued earlier for that same user. Convite and nova
 * senha share this primitive (see design.md); only one link may be live for
 * an account at a time (specs/admin-auth: "Reenvio ou nova senha invalida o
 * token anterior").
 */
export async function issueResetTokenWith(
  ctx: ResetTokenAuthContext,
  userId: string,
): Promise<string> {
  await deleteResetTokensWith(ctx, userId);

  const expiresInSeconds =
    ctx.options.emailAndPassword?.resetPasswordTokenExpiresIn ?? 3600;
  const token = randomBytes(24).toString("base64url");

  await ctx.internalAdapter.createVerificationValue({
    identifier: `${RESET_TOKEN_PREFIX}${token}`,
    value: userId,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
  });

  return token;
}

/** Same-origin URL an e-mail's button sends the recipient back to. Lives here
 * rather than beside either caller: both the office's own reset and the one a
 * person asks for themselves need it, and it is the origin `buildResetPasswordUrl`
 * below consumes. */
export function resolveOrigin(requestHeaders: Headers): string {
  const host = requestHost(requestHeaders) ?? "localhost:3000";
  const proto = process.env.NODE_ENV === "production" ? "https" : "http";
  return `${proto}://${host}`;
}

/** Where the account e-mail's button sends the recipient. */
export function buildResetPasswordUrl(origin: string, token: string): string {
  return `${origin}/admin/redefinir-senha?token=${token}`;
}

/** Where the e-mail-change confirmation sends the recipient. */
export function buildConfirmEmailUrl(origin: string, token: string): string {
  return `${origin}/admin/confirmar-email?token=${token}`;
}
