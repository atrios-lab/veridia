import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as authSchema from "./auth-schema.ts";
import * as schema from "./schema.ts";

export const fullSchema = { ...schema, ...authSchema };
export type FullSchema = typeof fullSchema;

// The driver-agnostic shape every `...With(db, ...)` function in src/lib
// takes: the production client (postgres-js, below) and the in-memory one
// tests build in src/db/test-db.ts (pglite) both satisfy it, because the
// query-result HKT only ever appears in output position on PgDatabase's
// methods. Query against this type, not against `typeof db`: pinning a
// function to the postgres-js class would make it reject the pglite client
// tests pass in.
export type Database = PgDatabase<PgQueryResultHKT, FullSchema>;

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
  schema: fullSchema,
});
