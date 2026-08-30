// Creates the Átrios platform account: the only role that logs in on every
// serventia's domain (see openspec/changes/add-atrios-super-admin). There is
// no panel screen for this — the account form only offers admin/staff — so
// this script is the sole way one comes into existence.
//
//   pnpm db:seed-superadmin
//
// Reads SUPERADMIN_SEED_EMAIL and SUPERADMIN_SEED_PASSWORD from .env.local.

import { SUPERADMIN_TENANT_SLUG } from "../src/core/auth/roles.ts";
import { isRegisteredSlug } from "../src/core/tenant/resolve.ts";
import { auth } from "../src/lib/auth.ts";

const email = process.env.SUPERADMIN_SEED_EMAIL;
const password = process.env.SUPERADMIN_SEED_PASSWORD;

if (!email || !password) {
  throw new Error("Defina SUPERADMIN_SEED_EMAIL e SUPERADMIN_SEED_PASSWORD.");
}

// The sentinel office must stay outside the registry: a superadmin's access
// comes from the role, not from this slug ever matching a real tenant.
if (isRegisteredSlug(SUPERADMIN_TENANT_SLUG)) {
  throw new Error(
    `"${SUPERADMIN_TENANT_SLUG}" foi registrado como serventia. Escolha ` +
      "outro sentinela em src/core/auth/roles.ts antes de rodar o seed.",
  );
}

const ctx = await auth.$context;

const existing = await ctx.internalAdapter.findUserByEmail(email);
if (existing) {
  console.log(`Usuário ${email} já existe. Nada a fazer.`);
  process.exit(0);
}

const user = await ctx.internalAdapter.createUser({
  email,
  name: "Átrios",
  emailVerified: true,
  role: "superadmin",
  tenantSlug: SUPERADMIN_TENANT_SLUG,
});

await ctx.internalAdapter.linkAccount({
  userId: user.id,
  providerId: "credential",
  accountId: user.id,
  password: await ctx.password.hash(password),
});

console.log(`Usuário ${email} criado como superadmin.`);
// A conexão do postgres() não fecha sozinha (sem idle_timeout, ver
// src/db/index.ts): sem isto o processo fica pendurado depois do log.
process.exit(0);
