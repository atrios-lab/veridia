import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { eq } from "drizzle-orm";
import { TENANTS } from "@/core/tenant/resolve.ts";
import type { Database } from "@/db/index.ts";
import { serviceRequests } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import { listUpcomingDataRightsDeadlinesWith } from "./admin-overview.ts";
import { createRecordWith } from "./service-request.ts";

const TENANT = TENANTS["cartorio-marinho"];

let db: Database;
let close: () => Promise<void>;

before(async () => {
  ({ db, close } = await createTestDb());
});

after(async () => {
  await close();
});

test("the LGPD term runs from the office's day, not from the UTC one", async () => {
  const { id } = await createRecordWith(db, TENANT, "data-rights", {
    applicantName: "Maria",
    contact: "maria@exemplo.com",
    description: "Quero saber quais dados a serventia guarda.",
  });
  // 22:30 on 3 November at the office, already the 4th in UTC.
  await db
    .update(serviceRequests)
    .set({ createdAt: new Date("2026-11-04T01:30:00Z") })
    .where(eq(serviceRequests.id, id));

  const upcoming = await listUpcomingDataRightsDeadlinesWith(
    db,
    TENANT.slug,
    "2026-11-15",
  );

  // Day 13 of 15 counting from the 3rd. From the 4th it would read 3 days left.
  assert.equal(upcoming.find((row) => row.id === id)?.daysLeft, 2);
});
