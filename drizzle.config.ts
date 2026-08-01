import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/db/schema.ts", "./src/db/auth-schema.ts"],
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  // `generate` writes SQL for a human to review; `push` would apply a diff
  // straight to the database with no history. See docs/migrations.md.
  strict: true,
  verbose: true,
});
