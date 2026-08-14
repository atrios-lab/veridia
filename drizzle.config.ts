import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// drizzle-kit does not read .env.local on its own, and Next does. Loading it
// here is what keeps one environment file for the whole project instead of
// two that drift apart. In the deploy the variable comes from the platform
// and the file is simply absent.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// The direct connection (not the Supavisor pooler DATABASE_URL uses at
// runtime), because DDL is not reliably supported behind a transaction-mode
// pooler.
const url = process.env.DIRECT_URL;
if (!url) {
  throw new Error(
    "DIRECT_URL nao esta definida. Preencha em .env.local com a URL de conexao direta da Supabase.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/db/schema.ts", "./src/db/auth-schema.ts"],
  out: "./drizzle",
  dbCredentials: { url },
  // `generate` writes SQL for a human to review; `push` would apply a diff
  // straight to the database with no history. See docs/migrations.md.
  strict: true,
  verbose: true,
});
