import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { viewKey } from "@/core/request/citizen-view.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import type { Database } from "@/db/index.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  citizenCienciaWith,
  listCitizenViewsWith,
  recordCitizenViewsWith,
} from "./citizen-views.ts";
import { createRecordWith } from "./service-request.ts";

// Fictitious data only.
const TENANT = TENANTS["cartorio-marinho"];
let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

test("a primeira vez fica; as seguintes só contam e movem a última", async () => {
  const { id } = await createRecordWith(db, TENANT, "service-request", {
    applicantName: "Fulano Exemplo",
    contact: "fulano@exemplo.com",
    description: "Pedido de teste.",
  });
  const mark = {
    target: "document" as const,
    targetId: "doc-1",
    action: "viewed" as const,
  };
  const first = new Date("2026-11-16T13:00:00Z");
  const later = new Date("2026-11-16T18:00:00Z");
  await recordCitizenViewsWith(
    db,
    TENANT.slug,
    id,
    [mark],
    { ip: "203.0.113.7", userAgent: "Navegador de teste" },
    first,
  );
  await recordCitizenViewsWith(
    db,
    TENANT.slug,
    id,
    [mark, { ...mark, action: "downloaded" }],
    { ip: "198.51.100.1" },
    later,
  );

  const rows = await listCitizenViewsWith(db, TENANT.slug, id);
  const viewed = rows.find((r) => r.action === "viewed");
  assert.deepEqual(viewed?.firstAt, first);
  assert.deepEqual(viewed?.lastAt, later);
  assert.equal(viewed?.times, 2);
  assert.equal(viewed?.firstIp, "203.0.113.7");
  assert.equal(viewed?.firstUserAgent, "Navegador de teste");

  const ciencia = await citizenCienciaWith(db, TENANT.slug, id);
  const doc = ciencia.get(viewKey("document", "doc-1"));
  assert.deepEqual(doc?.viewedAt, first);
  assert.deepEqual(doc?.downloadedAt, later);

  // Another office reads nothing of this request.
  assert.equal(
    (await listCitizenViewsWith(db, "outra-serventia", id)).length,
    0,
  );
});
