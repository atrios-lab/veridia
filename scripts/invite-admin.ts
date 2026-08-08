// Issues a first-access link for a panel user that already exists (created
// by scripts/seed-admin.ts). Useful for local/CI setup and as a fallback
// when nobody can reach the Usuários screen's "Reenviar convite" button
// (add-invite-and-login-flows), which is the primary path now.
//
//   pnpm db:invite admin@exemplo.com
//
// Reaches into ctx.internalAdapter directly, same as seed-admin.ts: there is
// no public endpoint for "mint a reset token without sending an email", and
// this script has no request to send one from anyway. Token issuance itself
// is shared with the Usuários screen's actions — see src/lib/auth-tokens.ts.
import { TENANTS } from "../src/core/tenant/resolve.ts";
import { auth } from "../src/lib/auth.ts";
import { issueResetTokenWith } from "../src/lib/auth-tokens.ts";

const email = process.argv[2];
if (!email) {
  throw new Error("Uso: pnpm db:invite <email>");
}

const ctx = await auth.$context;

const found = await ctx.internalAdapter.findUserByEmail(email);
if (!found) {
  throw new Error(
    `Nenhum usuário com o e-mail ${email}. Rode o seed primeiro.`,
  );
}
// The internal adapter's read type does not know about tenantSlug, the
// field this app added via USER_ADDITIONAL_FIELDS — it is there at runtime,
// same as the write side (createUser) already relies on.
const user = found.user as typeof found.user & { tenantSlug: string };

const token = await issueResetTokenWith(ctx, user.id);

const tenant = TENANTS[user.tenantSlug];
const host = tenant?.hosts[0] ?? "localhost:3000";
const expiresInSeconds =
  ctx.options.emailAndPassword?.resetPasswordTokenExpiresIn ?? 3600;
const hours = Math.round(expiresInSeconds / 3600);

console.log(`Convite para ${email} (${tenant?.name ?? user.tenantSlug}):`);
console.log(`  https://${host}/admin/redefinir-senha?token=${token}`);
console.log(`  Válido por ${hours}h.`);
