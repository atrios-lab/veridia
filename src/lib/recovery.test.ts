import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { eq } from "drizzle-orm";
import type { Database } from "@/db/index.ts";
import { riProperties } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  listChangesWith,
  listRemovedWith,
  restoreRemovedWith,
  revertChangeWith,
} from "./recovery.ts";

let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

// Fictitious data only (LGPD).
const T = "cartorio-teste-recuperar";
const A = { id: "u-superadmin" };

test("o super admin recupera o apagado e desfaz uma alteração", async () => {
  const [p] = await db
    .insert(riProperties)
    .values({
      tenantSlug: T,
      number: 9,
      origin: "nova origem",
      deletedAt: new Date(),
      deletedBy: "u-x",
      history: [
        {
          at: "2026-11-26T10:00:00Z",
          by: "u-x",
          changes: [
            { field: "origin", before: "origem antiga", after: "nova origem" },
          ],
        },
      ],
    })
    .returning({ id: riProperties.id });
  const id = p?.id as string;
  const removed = await listRemovedWith(db, T);
  const item = removed.find((r) => r.id === id);
  assert.equal(item?.flag, "deletedAt");
  await restoreRemovedWith(
    db,
    T,
    { table: item?.table as string, id, flag: "deletedAt", reason: "teste" },
    A,
  );
  let [row] = await db
    .select()
    .from(riProperties)
    .where(eq(riProperties.id, id));
  assert.equal(row?.deletedAt, null);
  const change = (await listChangesWith(db, T)).find((c) => c.id === id);
  assert.ok(change);
  await revertChangeWith(
    db,
    T,
    {
      table: change?.table as string,
      id,
      index: change?.index as number,
      reason: "teste",
    },
    A,
  );
  [row] = await db.select().from(riProperties).where(eq(riProperties.id, id));
  assert.equal(row?.origin, "origem antiga");
});
