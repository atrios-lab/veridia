import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

// One citizen per time, against Postgres in process. This rule lives in a
// partial unique index rather than in application code: two citizens can press
// the button in the same instant, and a count read a moment earlier is not
// evidence of anything. If this index ever stops holding, two people show up
// at the counter for the same hour.

const MIGRATIONS_DIR = "drizzle";
const UNIQUE_VIOLATION = "23505";

let client: PGlite;

async function book(
  date: string,
  slotTime: string,
  citizenName: string,
  status = "booked",
): Promise<void> {
  await client.query(
    `INSERT INTO appointments
       (tenant_slug, date, slot_time, citizen_name, email, phone,
        service_id, service_label, mode, status, cancel_token_hash)
     VALUES ('cartorio-marinho', $1, $2, $3, 'x@exemplo.com', '(84) 90000-0000',
             'procuracao', 'Procuração', 'Presencial', $4, $5)`,
    [
      date,
      slotTime,
      citizenName,
      status,
      `hash-${date}-${slotTime}-${citizenName}`,
    ],
  );
}

async function expectRefused(promise: Promise<unknown>): Promise<void> {
  await assert.rejects(promise, (error: { code?: string }) => {
    assert.equal(error.code, UNIQUE_VIOLATION);
    return true;
  });
}

before(async () => {
  client = new PGlite();
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

test("two citizens cannot hold the same day and time", async () => {
  await book("2026-08-18", "09:00", "Ana");
  await expectRefused(book("2026-08-18", "09:00", "Bruno"));

  // The same hour on another day, and another hour on the same day, are
  // different slots and must both be free.
  await book("2026-08-19", "09:00", "Bruno");
  await book("2026-08-18", "10:00", "Carla");
});

test("another office is never blocked by this one's agenda", async () => {
  await client.query(
    `INSERT INTO appointments
       (tenant_slug, date, slot_time, citizen_name, email, phone,
        service_id, service_label, mode, cancel_token_hash)
     VALUES ('tabelionato-aurora', '2026-08-18', '09:00', 'Ana', 'x@exemplo.com',
             '(84) 90000-0000', 'procuracao', 'Procuração', 'Presencial', 'outro-hash')`,
  );
});

test("cancelling gives the time back", async () => {
  await book("2026-08-20", "08:30", "Ana");
  await expectRefused(book("2026-08-20", "08:30", "Bruno"));

  await client.query(
    "UPDATE appointments SET status = 'cancelled' WHERE date = '2026-08-20'",
  );
  await book("2026-08-20", "08:30", "Bruno");
});

test("an attended visit keeps holding its time", async () => {
  // The bug this guards against: marking an early-arriving citizen as served
  // used to drop the row out of the index, putting an hour that was already
  // spent back on sale for whoever loaded the page next.
  await book("2026-08-21", "11:00", "Ana", "attended");
  await expectRefused(book("2026-08-21", "11:00", "Bruno"));
});

test("two cancellations of the same slot can coexist", async () => {
  // Cancelled rows are history, not reservations: several of them on one slot
  // is what a day of people giving up their time looks like.
  await book("2026-08-24", "09:00", "Ana", "cancelled");
  await book("2026-08-24", "09:00", "Bruno", "cancelled");
  await book("2026-08-24", "09:00", "Carla");
  await expectRefused(book("2026-08-24", "09:00", "Diego"));
});
