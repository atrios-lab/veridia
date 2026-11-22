import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { and, eq } from "drizzle-orm";
import type { Database } from "@/db/index.ts";
import { auditLog } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  getComplianceDoneWith,
  setComplianceDoneWith,
  withdrawComplianceDoneWith,
} from "./compliance.ts";

const OFFICE = "cartorio-cumprido";
let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

test("já cumpri: marca, edita guardando a anterior e desfaz sem apagar", async () => {
  assert.equal((await getComplianceDoneWith(db, OFFICE)).current, null);
  await setComplianceDoneWith(
    db,
    OFFICE,
    {
      doneOn: "2026-11-20",
      justicaAberta: false,
      justicaAbertaOn: "",
      note: "",
    },
    "user-1",
  );
  await setComplianceDoneWith(
    db,
    OFFICE,
    {
      doneOn: "2026-11-20",
      justicaAberta: true,
      justicaAbertaOn: "2026-11-21",
      note: "",
    },
    "user-1",
  );
  let done = await getComplianceDoneWith(db, OFFICE);
  assert.equal(done.current?.justicaAberta, true);
  assert.equal(done.history.length, 1);
  assert.equal(done.history[0]?.change, "edited");
  await withdrawComplianceDoneWith(db, OFFICE, "user-1");
  done = await getComplianceDoneWith(db, OFFICE);
  assert.equal(done.current, null);
  assert.equal(done.history.length, 2);
  assert.equal(done.history[1]?.change, "withdrawn");
  const audits = await db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.tenantSlug, OFFICE)));
  assert.deepEqual(audits.map((a) => a.action).sort(), [
    "compliance-intake.done",
    "compliance-intake.done-edited",
    "compliance-intake.done-withdrawn",
  ]);
});
