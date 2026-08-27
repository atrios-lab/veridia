import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { toBounceRecord } from "../core/email/bounce.ts";
import { emailBounces } from "./schema.ts";

// The bounce table (tratar-email-que-volta), same store-level approach as
// delete-account.test.ts: what is asserted is what the endpoint writes and
// what the sending path reads, not the route handler, which needs a request
// this suite does not build.

const MIGRATIONS_DIR = "drizzle";

let client: PGlite;
let db: ReturnType<typeof drizzle>;

before(async () => {
  client = new PGlite();
  db = drizzle(client);
  for (const file of readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) await client.exec(statement);
    }
  }
});

after(async () => {
  await client.close();
});

/** What the endpoint does with a validated body. */
async function record(body: {
  Email: string;
  Type: string;
  Description?: string;
}) {
  const row = toBounceRecord(
    { ...body, Email: body.Email.toLowerCase() },
    new Date("2026-08-26T12:00:00Z"),
  );
  await db
    .insert(emailBounces)
    .values(row)
    .onConflictDoUpdate({
      target: emailBounces.email,
      set: {
        kind: row.kind,
        detail: row.detail,
        permanent: row.permanent,
        occurredAt: row.occurredAt,
      },
    });
}

/** What sendEmail asks before calling the provider. */
async function permanentBounceFor(email: string) {
  const [row] = await db
    .select({ detail: emailBounces.detail, permanent: emailBounces.permanent })
    .from(emailBounces)
    .where(eq(emailBounces.email, email));
  return row?.permanent ? row : null;
}

test("a hard bounce is found by the sending path", async () => {
  await record({
    Email: "rosa.fontes@email.com",
    Type: "HardBounce",
    Description: "mailbox not found",
  });
  const found = await permanentBounceFor("rosa.fontes@email.com");
  assert.ok(found);
  assert.equal(found.detail, "mailbox not found");
});

test("a temporary bounce is recorded but does not block", async () => {
  await record({
    Email: "caixa.cheia@exemplo.com",
    Type: "SoftBounce",
    Description: "mailbox full",
  });

  // Recorded: the office may want to know later.
  const [row] = await db
    .select({ kind: emailBounces.kind })
    .from(emailBounces)
    .where(eq(emailBounces.email, "caixa.cheia@exemplo.com"));
  assert.equal(row.kind, "SoftBounce");

  // But a full mailbox says something about today, not about the address:
  // blocking on it would lock a citizen out over something temporary.
  assert.equal(await permanentBounceFor("caixa.cheia@exemplo.com"), null);
});

test("a second notice updates the address instead of duplicating it", async () => {
  const email = "duas.vezes@exemplo.com";
  await record({ Email: email, Type: "SoftBounce", Description: "primeira" });
  await record({ Email: email, Type: "HardBounce", Description: "segunda" });

  const rows = await db
    .select({ kind: emailBounces.kind, detail: emailBounces.detail })
    .from(emailBounces)
    .where(eq(emailBounces.email, email));
  assert.equal(rows.length, 1, "o endereço é a chave, não o aviso");
  assert.equal(rows[0].kind, "HardBounce");
  assert.equal(rows[0].detail, "segunda");
  assert.ok(await permanentBounceFor(email));
});

test("an address nobody reported goes through", async () => {
  assert.equal(await permanentBounceFor("nunca.voltou@exemplo.com"), null);
});
