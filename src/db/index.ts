import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as authSchema from "./auth-schema.ts";
import * as schema from "./schema.ts";

// The placeholder keeps `next build` and CI working with no database and no
// secret. `postgres()` never connects at construction time, and any real
// query against it fails loudly on the first request.
// "||", not "??": an empty DATABASE_URL in a local .env is the common case
// and it has to fall back exactly like an absent one.
const connectionString =
  process.env.DATABASE_URL || "postgresql://build:build@localhost:5432/build";

// DATABASE_URL points at the Supabase pooler (Supavisor, transaction mode):
// every request runs in its own serverless invocation, and without pooling
// that would exhaust the database's connection limit under concurrency.
// `prepare: false` is required in transaction mode, which has no session to
// hold a prepared statement across queries.
export const db = drizzle(postgres(connectionString, { prepare: false }), {
  schema: { ...schema, ...authSchema },
});
