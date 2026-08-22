// No "server-only" guard, and no static import of ./auth.ts: this file is
// imported directly by src/lib/auth-tokens.test.ts under plain
// `node --test`, and auth.ts throws at import time when
// BETTER_AUTH_SECRET is unset (as it is for a unit test). Callers already
// hold a `ctx` (from `await auth.$context`) for their own reasons: see
// usuarios/actions.ts and scripts/invite-admin.ts, and pass it in, the
// same way session-revocation.test.ts and invite.test.ts build their own
// auth instance rather than reaching for the app's singleton.
import { randomBytes } from "node:crypto";

const RESET_TOKEN_PREFIX = "reset-password:";

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
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const proto = process.env.NODE_ENV === "production" ? "https" : "http";
  return `${proto}://${host}`;
}

/** Where the account e-mail's button sends the recipient. */
export function buildResetPasswordUrl(origin: string, token: string): string {
  return `${origin}/admin/redefinir-senha?token=${token}`;
}
