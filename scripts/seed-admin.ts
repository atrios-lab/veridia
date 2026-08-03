// Creates a panel user. There is no public sign up, so this script (or an
// internal invite) is the only way a user comes into existence.
//
//   pnpm db:seed
//
// Reads ADMIN_SEED_EMAIL, ADMIN_SEED_PASSWORD and ADMIN_SEED_TENANT from
// .env.local. Every user belongs to exactly one office, so serving a second
// office means running this again with another ADMIN_SEED_TENANT.
import { isRegisteredSlug } from "../src/core/tenant/resolve.ts";
import { auth } from "../src/lib/auth.ts";

const email = process.env.ADMIN_SEED_EMAIL;
const password = process.env.ADMIN_SEED_PASSWORD;
// Falls back to the office served on an unmapped host, which is what keeps
// an existing setup working with no configuration change.
const tenantSlug = process.env.ADMIN_SEED_TENANT ?? process.env.DEFAULT_TENANT;

if (!email || !password) {
  throw new Error("Defina ADMIN_SEED_EMAIL e ADMIN_SEED_PASSWORD.");
}

// Checked before touching the database: a user pointing at an office that
// does not exist can never sign in anywhere.
if (!tenantSlug || !isRegisteredSlug(tenantSlug)) {
  throw new Error(
    `Defina ADMIN_SEED_TENANT com o slug de uma serventia registrada. ` +
      `Recebido: "${tenantSlug ?? ""}".`,
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
  name: "Administrador",
  emailVerified: true,
  role: "admin",
  tenantSlug,
});

await ctx.internalAdapter.linkAccount({
  userId: user.id,
  providerId: "credential",
  accountId: user.id,
  password: await ctx.password.hash(password),
});

console.log(`Usuário ${email} criado como admin de ${tenantSlug}.`);
