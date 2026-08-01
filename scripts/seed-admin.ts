// Creates the first panel user. There is no public sign up, so this script
// (or an internal invite) is the only way a user comes into existence.
//
//   pnpm db:seed
//
// Reads ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD from .env.local.
import { auth } from "../src/lib/auth.ts";

const email = process.env.ADMIN_SEED_EMAIL;
const password = process.env.ADMIN_SEED_PASSWORD;

if (!email || !password) {
  throw new Error("Defina ADMIN_SEED_EMAIL e ADMIN_SEED_PASSWORD.");
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
});

await ctx.internalAdapter.linkAccount({
  userId: user.id,
  providerId: "credential",
  accountId: user.id,
  password: await ctx.password.hash(password),
});

console.log(`Usuário ${email} criado como admin.`);
