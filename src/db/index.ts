import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as authSchema from "./auth-schema.ts";
import * as schema from "./schema.ts";

// neon-http, not a pool: every request runs in its own serverless instance,
// so a connection pool would only be a pool of one waiting to be discarded.
//
// The placeholder keeps `next build` and CI working with no database and no
// secret. It never connects at build time, and any real query against it
// fails loudly on the first request.
// "||", not "??": an empty DATABASE_URL in a local .env is the common case
// and it has to fall back exactly like an absent one.
const connectionString =
  process.env.DATABASE_URL || "postgresql://build:build@localhost:5432/build";

export const db = drizzle(neon(connectionString), {
  schema: { ...schema, ...authSchema },
});
