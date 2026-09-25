import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { and, eq } from "drizzle-orm";
import type { BulletinFigures } from "@/core/transparency/bulletin.ts";
import type { Database } from "@/db/index.ts";
import { auditLog, tenantContent, transparencyBulletins } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import { OFFICE_BULLETIN_KEY } from "./office-config.ts";
import {
  bulletinFiguresOf,
  getBulletinWith,
  saveBulletinOptionWith,
  upsertBulletinWith,
} from "./transparency.ts";

const TENANT = "cartorio-canguaretama";
const ACTOR = "user-operadora";

let db: Database;
let close: () => Promise<void>;

before(async () => {
  ({ db, close } = await createTestDb());
});

after(async () => {
  await close();
});

const FIGURES: BulletinFigures = {
  actsCount: 267,
  fundAmountsCents: {
    fdj: 123_456,
    frmp: 32_100,
    fcrcpn: 21_040,
    funaf: 9_810,
  },
  issCents: 61_200,
  grossRevenueCents: 797_812,
  expensesCents: 806_931,
};

async function rowsFor(month: string) {
  return db
    .select()
    .from(transparencyBulletins)
    .where(
      and(
        eq(transparencyBulletins.tenantSlug, TENANT),
        eq(transparencyBulletins.referenceMonth, month),
      ),
    );
}

test("a published bulletin reads back fund by fund, with ISS and private figures", async () => {
  await upsertBulletinWith(
    db,
    TENANT,
    { referenceMonth: "2026-01-01", figures: FIGURES, status: "preliminary" },
    ACTOR,
  );

  const [row] = await rowsFor("2026-01-01");
  assert.ok(row);
  assert.equal(row.taxesPaidCents, null);
  const again = await getBulletinWith(db, TENANT, row.id);
  assert.ok(again);
  assert.deepEqual(bulletinFiguresOf(again, "RN"), FIGURES);
});

test("publishing the same month again replaces it, never a second row", async () => {
  const month = "2026-02-01";
  await upsertBulletinWith(
    db,
    TENANT,
    { referenceMonth: month, figures: FIGURES, status: "preliminary" },
    ACTOR,
  );
  await upsertBulletinWith(
    db,
    TENANT,
    {
      referenceMonth: month,
      figures: { ...FIGURES, issCents: 70_000 },
      status: "consolidated",
    },
    ACTOR,
  );

  const rows = await rowsFor(month);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "consolidated");
  assert.equal(rows[0].issCents, 70_000);
});

test("publishing with the option off stores no gross revenue or expenses", async () => {
  const month = "2026-03-01";
  await upsertBulletinWith(
    db,
    TENANT,
    {
      referenceMonth: month,
      figures: { ...FIGURES, grossRevenueCents: null, expensesCents: null },
      status: "consolidated",
    },
    ACTOR,
  );

  const [row] = await rowsFor(month);
  assert.equal(row.grossRevenueCents, null);
  assert.equal(row.expensesCents, null);
});

test("another office's bulletin id answers nothing", async () => {
  const [row] = await rowsFor("2026-01-01");
  assert.equal(
    await getBulletinWith(db, "cartorio-marinho", row.id),
    undefined,
  );
});

test("a row whose funds are not the state's reads as an error, not as zeros", async () => {
  const [row] = await rowsFor("2026-01-01");
  assert.equal(
    bulletinFiguresOf({ ...row, fundAmountsCents: { fdj: 100 } }, "RN"),
    null,
  );
});

test("saving the option writes the override and leaves a trail", async () => {
  await saveBulletinOptionWith(db, TENANT, false, ACTOR);
  await saveBulletinOptionWith(db, TENANT, true, ACTOR);

  const rows = await db
    .select()
    .from(tenantContent)
    .where(
      and(
        eq(tenantContent.tenantSlug, TENANT),
        eq(tenantContent.key, OFFICE_BULLETIN_KEY),
      ),
    );
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].published, { publishBulletinPrivateFigures: true });

  const trail = await db
    .select()
    .from(auditLog)
    .where(
      and(
        eq(auditLog.tenantSlug, TENANT),
        eq(auditLog.targetId, OFFICE_BULLETIN_KEY),
      ),
    );
  assert.equal(trail.length, 2);
  assert.equal(trail[0].actorId, ACTOR);
});
