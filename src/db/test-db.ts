// Test-only helper: PostgreSQL in memory (PGlite), migrated with the same
// SQL files production runs through `drizzle-kit migrate`, wrapped in a
// Drizzle client that satisfies the same `Database` type src/db/index.ts
// exports. A `...With(db, ...)` function in src/lib never knows which one it
// got.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { fullSchema } from "./index.ts";

const MIGRATIONS_DIR = "drizzle";

async function applyMigrations(client: PGlite): Promise<void> {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) await client.exec(statement);
    }
  }
}

/**
 * A fresh in-memory database, migrated and ready. Call `close()` in the
 * suite's `after`; PGlite holds no external resource, but leaving it open
 * across files is how one test's data leaks into another's.
 */
export async function createTestDb(): Promise<{
  db: ReturnType<typeof drizzle<typeof fullSchema>>;
  close: () => Promise<void>;
}> {
  const client = new PGlite();
  await applyMigrations(client);
  const db = drizzle(client, { schema: fullSchema });
  return { db, close: () => client.close() };
}
